// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract RoyaltyDistribution1 is Ownable {
    // Total number of PNK
    uint public constant PnkTotalCount = 10000;

    // Number of NFTs to handle in one page when making the snapshop
    uint public constant SnapshotPageSize = 1000;

    // Number of recipients to send royalties to in one transaction
    uint public constant DistrPageSize = 1000;

    // Default snapshot page
    uint public constant DefaultSnapshotPage = 0xffff;

    // Minimum interval between snapshots, can be overridden in constructor
    uint public minSnapshotInterval = 12 hours;

    // Minimum interval after last distribution before the permissionless
    // distribution can happen, can be overridden in constructor
    uint public minPermissionlessDistributionInterval = 106 days;

    // Last handled snapshot page
    uint public lastSnapshotPage = DefaultSnapshotPage;

    // The address of the PNK collection
    address public punkCollectionAddress = address(0);

    // The address of the CHEL collection
    address public chelCollectionAddress = address(0);

    // Iterable set of snapshot addresses
    mapping(address => address) public snapShot;
    address public firstSnapshotAddress = address(0);
    uint public snapshotSize = 0;
    uint public lastSnapshotTimestamp = 0;

    // Last time the distribution happened
    uint public lastDistributionTimestamp = 0;

    // Total accumulated royalties to be distributed
    uint public accumulatedRoyalties = 0;

    // Amount of royalties to be sent to each address in this snapshot
    uint public disburseAmount = 0;

    // Event that indicates that snapShot iteration is over
    event SnapshotIterationFinished();

    // Event for receiving funds
    event Received(uint amount);

    // Event for sending royalties to a recipient
    event RoyaltySent(address recipient, uint amount);

    constructor(uint _minSnapshotInterval, uint _minPermissionlessDistributionInterval) {
        if (_minSnapshotInterval != 0) {
            minSnapshotInterval = _minSnapshotInterval;
        }
        if (_minPermissionlessDistributionInterval != 0) {
            minPermissionlessDistributionInterval = _minPermissionlessDistributionInterval;
        }
    }

    /**
     * Default payable method
     *
     * Receive and register funds sent to this contract address
     */
    receive() external payable {
        accumulatedRoyalties += msg.value;
        emit Received(msg.value);
    }

    /**
     * Set the collection addresses
     *
     * @param _punkCollectionAddress - address of PNK collection
     * @param _chelCollectionAddress - address of CHEL collection
     */
    function setCollectionAddresses(address _punkCollectionAddress, address _chelCollectionAddress) public onlyOwner {
        require(punkCollectionAddress == address(0));
        require(chelCollectionAddress == address(0));

        punkCollectionAddress = _punkCollectionAddress;
        chelCollectionAddress = _chelCollectionAddress;
    }

    /**
     * Take the snapshot (paginated call)
     *
     * @param _page - zero based page number
     */
    function takeSnapshop(uint _page) public {
        // Validate the parameters
        require(((lastSnapshotPage == DefaultSnapshotPage) && (_page == 0)) || (_page == lastSnapshotPage + 1));
        require(block.timestamp >= lastSnapshotTimestamp + minSnapshotInterval);

        // First page
        if (lastSnapshotPage == DefaultSnapshotPage) {
            // Snapshot should be empty
            require(firstSnapshotAddress == address(0));
        }

        // Get the collection contract
        IERC721 pnkCollection = IERC721(punkCollectionAddress);
        IERC721 chelCollection = IERC721(chelCollectionAddress);

        // Iterate over the next page of punks and populate snapshot
        address lastSnapshotAddress = address(0);
        for (uint pnkId = _page * SnapshotPageSize + 1; pnkId <= (_page + 1) * SnapshotPageSize; pnkId++) {
            address pnkOwner = pnkCollection.ownerOf(pnkId);
            if (chelCollection.balanceOf(pnkOwner) != 0) {
                if (firstSnapshotAddress == address(0)) {
                    firstSnapshotAddress = pnkOwner;
                    snapshotSize = 1;
                }
                if (lastSnapshotAddress != address(0)) {
                    snapShot[lastSnapshotAddress] = pnkOwner;
                    snapshotSize++;
                }
                lastSnapshotAddress = pnkOwner;
            }
        }

        // Last page
        if (_page == PnkTotalCount / SnapshotPageSize - 1) {
            lastSnapshotPage = DefaultSnapshotPage;
            lastSnapshotTimestamp = block.timestamp;

            if (snapshotSize != 0) {
                // Calculate the amount for each individual recipient
                // If "[]" means integer part, then
                // snapshotSize * [accumulatedRoyalties / snapshotSize] <= accumulatedRoyalties
                // i.e. the contract never runs out of money due to rounding errors, but there
                // might be some negligible amount of leftovers
                disburseAmount = accumulatedRoyalties / snapshotSize;

                // ... and reset accumulated royalties. Any royalties received after this point
                // will be distributed in the next snapshot
                accumulatedRoyalties = 0;
            }
        }
    }

    /**
     * Clear the snapshot (needs to be called multiple times until emits SnapshotIterationFinished event)
     */
    function clearSnapshop() public {
        // Require the snapshot to expire
        require(block.timestamp >= lastSnapshotTimestamp + minSnapshotInterval);

        // Delete up to SnapshotPageSize addresses from snapshot
        address lastSnapshotAddress = firstSnapshotAddress;
        for (uint i=0; i<SnapshotPageSize; i++) {
            // Get the key address to delete
            address keyToDelete = snapShot[lastSnapshotAddress];

            // Move to the next address
            lastSnapshotAddress = snapShot[lastSnapshotAddress];

            // Check if we finished deleting
            if (keyToDelete == address(0)) {
                snapshotSize = 0;
                disburseAmount = 0;
                emit SnapshotIterationFinished();
                break;
            }

            // Delete
            snapShot[keyToDelete] = address(0);
        }

        // Point to the address where we stopped (could be address(0), in which case this is the end)
        firstSnapshotAddress = lastSnapshotAddress;
    }

    /**
     * Send royalties to all recipients (should be called multiple times)
     */
    function distributePrivate() private {
        // Require the snapshot to be current
        require(block.timestamp < lastSnapshotTimestamp + minSnapshotInterval);

        // Distribute to up to DistrPageSize addresses from snapshot
        address payable nextSnapshotAddress = payable(firstSnapshotAddress);
        for (uint i=0; i<DistrPageSize; i++) {
            // Send royalties to nextSnapshotAddress
            // Use `send` as it limits gas to 2300 and doesn't throw if nextSnapshotAddress is a contract
            if (nextSnapshotAddress.send(disburseAmount)) {
                emit RoyaltySent(nextSnapshotAddress, disburseAmount);
            }

            // Move to the next address
            nextSnapshotAddress = payable(snapShot[nextSnapshotAddress]);

            // Check if we're finished
            if (nextSnapshotAddress == address(0)) {
                lastDistributionTimestamp = block.timestamp;
                emit SnapshotIterationFinished();
                break;
            }
        }

        // Point to the address where we stopped, and which should be handled first in the next call.
        // (could be address(0), in which case snapshot iteration is finished)
        firstSnapshotAddress = nextSnapshotAddress;
    }

    /**
     * Send royalties to all recipients (should be called multiple times)
     * Can only be called by contract owner
     */
    function distribute() public onlyOwner {
        distributePrivate();
    }

    /**
     * Send royalties to all recipients (should be called multiple times)
     * Canbe called by anyone if the owner didn't call the distribute for too long
     */
    function distributePermissionless() public {
        require(block.timestamp - lastDistributionTimestamp >= minPermissionlessDistributionInterval);
        distributePrivate();
    }
}
