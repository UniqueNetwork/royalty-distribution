# Royalty Distribution Contracts and Scripts

## Smart Contracts

### Contract 1: Equal distribution between owners of both PNK and CHEL

#### Snapshot algorithm

The snapshot can be taken by calling `takeSnapshop` method that accepts `pageNumber` parameter. Page number is the 0-based page number of PNK owners. The page size `PageSize` is hardcoded to optimize the gas consumption. The contract stores the last page number successfully handled, which is 0xFFFF by default. The value of 0xFFFF means that the process of taking a snapshop can be started over with a 0 `pageNumber` parameter. Any other `pageNumber` values will cause this method to fail in this case. Each consecutive call to `takeSnapshop` will only succeed if the `pageNumber` parameter is greater than previously handled page number by 1. Once the last handled page number reaches the maximum, it is reset back to 0xFFFF, and the snapshop is frozen for 12 hours meaning that calling `takeSnapshop` will fail until this interval is over. This design allows making `takeSnapshop` method both permissionless and safe: Any address can execute `takeSnapshop` on the date of distribution, but executing it ahead of time or after the distribution date will not affect the distribution. Also, executing it too frequently to cause a DOS attack on distribution becomes impossible.

The algorithm should start with clearing the distribution snapshot by calling `clearSnapshot` until it returns `SnapshotIterationFinished` event. The `clearSnapshot` will be removing `pageSize` count of addresses stored in the snapshot until it is empty.

If `takeSnapshot` is called with `pageNumber` parameter equal to 0 and the snapshot is not cleared, it will revert. The `takeSnapshot` will iterate over the page taking the owner address of each PNK at a time and checking if this address also owns any CHEL. If it does, the address will be added to the distribution snapshop (if not already there).

After the last page is handled, the block of `lastSnapshotTimestamp` will be populated with the current block timestamp.


#### Distribution algorithm

The distribution can be initiated by calling `distribute` method. This method will only proceed if the `lastSnapshotTimestamp` is within approximately 12 hours of current block, otherwise it will fail. Also, the `distribute` method can only be called by the contract owner to prevent premature distribution because the distibution needs to happen once per quarter, and on the exact dates vs. block number range, which is hard to estimate. Nonetheless, in order to make the distribution fully permissionless, there is another method called `distributePermissionless`, which can be called by any address and will cause the distribution if the `distribute` method was not called in time, i.e. if the last distribution happened more than 106 days ago (three months plus two weeks).

The algorithm will calculate the amount to distribute to each address by dividing the total royalties by the number of recepients, then it will iterate over the snapshot and send the amounts to the recepients. This algorithm is also paginated, i.e. the methods receive `pageNumber` parameter, and require it to iterate by 1 between calls, exactly like `takeSnapshop` does. Once the last page is handled, the `lastDistributionBlock` is set to the number of current block.

## Setting up development environment

```
yarn install
```

## Testing

```
truffle build
truffle migrate --network opal
truffle test --network opal
```

### Test Collections on Opal

The test PNK and CHEL collections are deployed on Opal network from the snapshot made on April 11th 2023 (exact match of token owners and variable on-chain data).

Collection IDs and addresses:
```
PNK
ID: 1160
Address: 0x17C4E6453CC49AaaAeaCa894e6d9683E00000488

CHEL
ID: 1169
Address: 0x17C4E6453CC49aAaaeACA894E6D9683e00000491
```
