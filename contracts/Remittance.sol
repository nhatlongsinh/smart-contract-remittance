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
    uint256 private _maxBlockExpiration;
    // list of orders by order Id
    // Order Id is puzzle
    mapping(bytes32 => Order) _orderOf;

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
    constructor(bool isRunning, uint256 maxBlockExpiration) public Stoppable(isRunning)
    {
        _maxBlockExpiration = maxBlockExpiration;
    }

    // PUBLIC METHODS
    // GETTERs
    // max block expiration
    function maxBlockExpiration() public view returns (uint256) {
        return _maxBlockExpiration;
    }
    // Get order with
    // valid order id
    function getOrder(bytes32 puzzle) public view
        returns(
            Order memory order
        )
    {
        order = _orderOf[puzzle];
    }

    // SETTERs
    // set max deadline block
    function setMaxBlockExpiration(uint256 max) public ownerOnly
    {
        require(max > 0, "Value must greater than zero");
        _maxBlockExpiration = max;
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
        require(blockExpiration <= _maxBlockExpiration,
            "Block Expiration must less than max block expiration"
        );

        Order storage newOrder = _orderOf[puzzle];

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
        require(_orderOf[puzzle].creator != address(0x0), "Order not available");
        uint256 balance =_orderOf[puzzle].amount;
        require(balance > 0, "Order is empty");

        _orderOf[puzzle].amount = 0;
        _orderOf[puzzle].expiredBlock = 0;

        // event
        emit ClaimOrderEvent(puzzle, msg.sender, balance, password);

        // transfer
        msg.sender.transfer(balance);
    }

    // Cancel order with valid puzzle
    function cancelOrder(bytes32 puzzle) public runningOnly
    {
        // get order
        Order memory order = _orderOf[puzzle];

        require(order.creator == msg.sender,
            "Only order creator to cancel order"
        );

        require(order.amount > 0, "Order is empty");

        require(block.number > order.expiredBlock,
            "Only cancel expired order"
        );

        // event
        emit CancelOrderEvent(puzzle, msg.sender);

        _orderOf[puzzle].amount = 0;
        _orderOf[puzzle].expiredBlock = 0;

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