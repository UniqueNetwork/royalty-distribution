const BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN, decimalSeparator: '.' });
const { MintableNonFungibleToken } = require('non-fungible-token-abi');
const abi = MintableNonFungibleToken;

const pnkTokens = require('./export_tokens_1.json');
const chelTokens = require('./export_tokens_2.json');

const RoyaltyDistribution1 = artifacts.require("RoyaltyDistribution1");
let sut;

contract("RoyaltyDistribution1", function (accounts) {

  before("Setup", async () => {
    // Get the contract instance
    sut = await RoyaltyDistribution1.deployed();
    const pnkCollectionId = await sut.punkCollectionAddress();
    const chelCollectionId = await sut.chelCollectionAddress();

    console.log("PNK collection address: ", pnkCollectionId);
    console.log("CHEL collection address: ", chelCollectionId);
    console.log("Royalty contract address: ", sut.address);
  });

  it.skip("Output token stats", async () => {
    let ownersOfBoth = 0;
    let pnkUniqueOwners = [];
    for (let i=0; i<pnkTokens.length; i++) {
      pnkUniqueOwners[pnkTokens[i].owner.substrate] = 1;
    }
    console.log(`Unique punk owners = ${Object.keys(pnkUniqueOwners).length}`);
    for (let i=0; i<chelTokens.length; i++) {
      if (pnkUniqueOwners[chelTokens[i].owner.substrate] == 1) {
        pnkUniqueOwners[chelTokens[i].owner.substrate] = 0;
        ownersOfBoth++;
      }
    }
    console.log(`ownersOfBoth = ${ownersOfBoth}`);
  });

  it.skip("Output 500 token owners from PNK contract", async () => {
    const collectionAddress = await sut.punkCollectionAddress();
    const nftContract = new web3.eth.Contract(abi, collectionAddress);
    for (let i=0; i<500; i++) {
      const owner = await nftContract.methods.ownerOf(i+1).call();
      console.log(owner);
    }
  });

  it.skip("Output 500 token owners from CHEL contract", async () => {
    const collectionAddress = await sut.chelCollectionAddress();
    const nftContract = new web3.eth.Contract(abi, collectionAddress);
    for (let i=0; i<500; i++) {
      const owner = await nftContract.methods.ownerOf(i+1).call();
      console.log(owner);
    }
  });

  it.only("PNK#1 owner balance in PNK collection is not zero", async () => {
    const collectionAddress = await sut.punkCollectionAddress();
    const nftContract = new web3.eth.Contract(abi, collectionAddress);
    const owner = await nftContract.methods.ownerOf(1).call();
    console.log(owner);
    const balance = await nftContract.methods.balanceOf(owner).call();
    console.log(balance);
  });

  it("Cannot set the collection IDs again", async () => {
    try {
      await sut.setCollectionAddresses("0x17C4E6453CC49AaaAeaCa894e6d9683E00000488", "0x17C4E6453CC49aAaaeACA894E6D9683e00000491", {from: accounts[0]});
    } catch (error) {
      return;
    }
    assert.isFalse(true, 'Setting collection IDs did not fail the second time');
  });

  it("Contract registers received funds", async () => {
    let amountToSend = new BigNumber(1e18);
    let registeredBalanceBefore = new BigNumber(await sut.accumulatedRoyalties());

    await web3.eth.sendTransaction({from: accounts[0], to: sut.address, value: amountToSend});

    let registeredBalanceAfter = new BigNumber(await sut.accumulatedRoyalties());

    assert.ok(registeredBalanceAfter.minus(registeredBalanceBefore).eq(amountToSend));
  });

  it.skip("Take a snapshot", async () => {
    // Wait until the snapshot expires
    const minSnapshotInterval = await sut.minSnapshotInterval();
    const lastSnapshotTimestamp = await sut.lastSnapshotTimestamp();
    const blockNumber = await web3.eth.getBlockNumber();
    console.log(`Current block = ${blockNumber}`);
    const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp;
    console.log(`minSnapshotInterval = ${minSnapshotInterval}, lastSnapshotTimestamp = ${lastSnapshotTimestamp}, timestamp = ${timestamp}`);

    // Clear the previous snapshot if there is one
    while (await sut.snapshotSize() > 0) {
      console.log(`Previous snapshot found, has size of ${await sut.snapshotSize()}. Clearing...`);
      const tx = await sut.clearSnapshot();
      assert.ok(tx.receipt.gasUsed < 15000000, `clearSnapshot consumed more than half block in gas (${tx.receipt.gasUsed})`);
    }

    // Take the snapshot
    const iterations = (await sut.PnkTotalCount()) / (await sut.SnapshotPageSize());
    for (let i=0; i<iterations; i++) {
      const tx = await sut.takeSnapshot(i);
      console.log(`Gas used: ${tx.receipt.gasUsed}`)
      assert.ok(tx.receipt.gasUsed < 15000000, `takeSnapshot consumed more than half block in gas (${tx.receipt.gasUsed})`);

      const snapshotSize = await sut.snapshotSize();
      console.log(`Snapshot page ${i+1} finished, snapshot size: ${snapshotSize}`);
    }

    const disburseAmount = await sut.disburseAmount();
    console.log(`Finished taking snapshot, each user will receive = ${disburseAmount}`);
  }).timeout(3600000); // This is a very long test

  // it("Lock an NFT", async () => {
  //   const token = new web3.eth.Contract(abi, collectionAddress);
  //   const balanceBefore = await token.methods.balanceOf(nftLockInst.address).call();

  //   // Approve NFT 1 for NFT Lock contract
  //   await token.methods.approve(nftLockInst.address, 1).send({from: nftOwnerAddress});
  //   console.log(`Approved NFT 1 in collection ${collectionId} from ${nftOwnerAddress} to ${nftLockInst.address}`);

  //   // Lock the NFT 1 with RFT collection 2, token 3
  //   console.log(`Contract address: ${nftLockInst.address}`);
  //   await nftLockInst.lock(collectionAddress, 1, 2, 3, {from: nftOwnerAddress});

  //   // Check that the contract receives the NFT
  //   const balanceAfter = await token.methods.balanceOf(nftLockInst.address).call();
  //   assert.ok(balanceAfter - balanceBefore == 1);
  // });

});
