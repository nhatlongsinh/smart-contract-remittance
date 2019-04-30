pragma solidity >=0.4.21 <0.6.0;
pragma experimental ABIEncoderV2;

import './Stoppable.sol';
import './SafeMath.sol';

contract Remittance is Stoppable {
    // library
    using SafeMath for uint;

    // ENUM
    // order status
    // Not_Set: null
    // Available: ready to send out
    // Cancelled: refunded to the owner, cancel order
    // Claimed: claimed by receiver
    enum OrderStatus {Not_Set, Available, Claimed, Cancelled}

    // STRUCT
    // order
    struct Order {
        uint256 amount;
        uint256 expiredBlock;
        address creator;
    }

    // PRIVATE VARIABLES
    // maximum number of blocks
    // limit to how far in the future the deadline can be 
    uint256 public maxBlockExpiration;
    // list of orders by order Id
    // Order Id is puzzle
    mapping(bytes32 => Order) public orders;

    // EVENTS
    // new order event
    event NewOrderEvent(
        address indexed sender, // as creator
        uint256 amount,
        uint256 expiredBlock,
        bytes32 indexed puzzle
    );
    // claim order event
    event ClaimOrderEvent(
        bytes32 indexed puzzle, 
        address indexed sender, // as receiver
        uint256 amount,
        bytes32 password
    );
    // cancel order event
    event CancelOrderEvent(
        bytes32 indexed puzzle,
        address indexed sender // as creator
    );
    // set max block expiration
    event SetMaxBlockExpirationEvent(
        address indexed sender,
        uint256 newValue
    );

    // constructor
    constructor(bool isRunning, uint256 _maxBlockExpiration) public Stoppable(isRunning)
    {
        maxBlockExpiration = _maxBlockExpiration;
    }

    // SETTERs
    // set max deadline block
    function setMaxBlockExpiration(uint256 max) public ownerOnly
    {
        require(max > 0, "Value must greater than zero");
        maxBlockExpiration = max;
        emit SetMaxBlockExpirationEvent(msg.sender, max);
    }

    // Create order with valid puzzle
    function createOrder(bytes32 puzzle, uint256 blockExpiration)
        public
        payable
        runningOnly
    {
        // validate inputs
        require(puzzle != 0, "Invalid Puzzle");
        require(msg.value > 0, "Ether amount must greater than zero");
        require(blockExpiration > 0, "Block Expiration must greater than zero");
        require(blockExpiration <= maxBlockExpiration,
            "Block Expiration must less than max block expiration"
        );

        Order storage newOrder = orders[puzzle];

        require(newOrder.creator == address(0x0), "Puzzle already exist");

        // CREATE
        // expired Block
        uint256 expiredBlock = block.number.add(blockExpiration);

        //create new order
        newOrder.amount= msg.value;
        newOrder.expiredBlock= expiredBlock;
        newOrder.creator= msg.sender;

        // event
        emit NewOrderEvent(msg.sender, msg.value, expiredBlock, puzzle);
    }

    // Claim order with password
    function claimOrder(bytes32 password) public runningOnly
    {
        // generate puzzle
        bytes32 puzzle = generatePuzzle(msg.sender, password);

        // get order
        require(orders[puzzle].creator != address(0x0), "Order not available");
        uint256 balance =orders[puzzle].amount;
        require(balance > 0, "Order is empty");

        orders[puzzle].amount = 0;
        orders[puzzle].expiredBlock = 0;

        // event
        emit ClaimOrderEvent(puzzle, msg.sender, balance, password);

        // transfer
        msg.sender.transfer(balance);
    }

    // Cancel order with valid puzzle
    function cancelOrder(bytes32 puzzle) public runningOnly
    {
        // get order
        Order memory order = orders[puzzle];

        require(order.creator == msg.sender,
            "Only order creator to cancel order"
        );

        require(order.amount > 0, "Order is empty");

        require(block.number > order.expiredBlock,
            "Only cancel expired order"
        );

        // event
        emit CancelOrderEvent(puzzle, msg.sender);

        orders[puzzle].amount = 0;
        orders[puzzle].expiredBlock = 0;

        // refund
        msg.sender.transfer(order.amount);
    }

    // generate puzzle
    function generatePuzzle(address receiver, bytes32 password)
        public
        view
        returns(bytes32 puzzle)
    {
        puzzle = keccak256(
            abi.encodePacked(this, receiver, password)
        );
    }
}