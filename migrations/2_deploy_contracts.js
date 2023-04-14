var RoyaltyDistribution1 = artifacts.require("RoyaltyDistribution1");

const TEST_SNAPSHOT_EXPIRATION_S = 60;
const TEST_PERMISSIONLESS_DIST_INTERVAL_S = 60;

module.exports = async function(deployer, network) {
  console.log(`Network: ${network}`);

  let SnapshotExpiration = 0;
  let PermissionlessDistInterval = 0;
  let pnkCollectionAddress = "0x17C4e6453cC49AAaaEaCA894E6D9683e00000001";
  let chelCollectionAddress = "0x17C4e6453cC49AAaaEaCA894E6D9683e00000002";

  // Replcace parameters on test network(s)
  if (network == "opal") {
    SnapshotExpiration = TEST_SNAPSHOT_EXPIRATION_S;
    PermissionlessDistInterval = TEST_PERMISSIONLESS_DIST_INTERVAL_S;
    pnkCollectionAddress = "0x17C4E6453CC49AaaAeaCa894e6d9683E00000488";
    chelCollectionAddress = "0x17C4E6453CC49aAaaeACA894E6D9683e00000491";
  }

  // Deploy the royalty distribution contract
  let rdInstance;
  let deploy = true;
  try {
    rdInstance = await RoyaltyDistribution1.deployed();
    deploy = false;
  } catch (e) {}
  if (deploy) {
    await deployer.deploy(RoyaltyDistribution1, SnapshotExpiration, PermissionlessDistInterval);
    rdInstance = await RoyaltyDistribution1.deployed();
    // Configure the contract with PNK and CHEL collection addresses
    await rdInstance.setCollectionAddresses(pnkCollectionAddress, chelCollectionAddress);
  }
  console.log(`RoyaltyDistribution1 contract address: ${rdInstance.address}`);
};