pragma solidity >=0.4.21 <0.6.0;

contract Data {
    // ENUM
    // order status
    // Available: ready to send out
    // Cancelled: refunded to the owner, cancel order
    // Claimed: claimed by receiver
    enum OrderStatus {Available, Claimed, Cancelled}

    // STRUCT
    // order
    struct Order {
        bytes32 puzzle;
        uint256 amount;
        uint256 expiredBlock;
        address owner;
        OrderStatus status;
    }
}