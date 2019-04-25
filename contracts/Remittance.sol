pragma solidity >=0.4.21 <0.6.0;

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
        address receiver;
        OrderStatus status;
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
        bytes32 indexed orderId, // puzzle
        address indexed sender, // as receiver
        uint256 amount,
        bytes32 password
    );
    // cancel order event
    event CancelOrderEvent(
        bytes32 indexed orderId,
        address indexed sender // as creator
    );
    // set max block expiration
    event SetMaxBlockExpirationEvent(
        address indexed sender,
        uint256 newValue
    );

    // MODIFIER
    // block expiration
    modifier blockExpirationValidOnly(uint256 blockExpiration)
    {
        require(blockExpiration <= _maxBlockExpiration,
            "Block Expiration must less than max block expiration"
        );
        _;
    }

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
    function getOrder(bytes32 orderId) public view
        returns(
            address creator,
            uint256 amount,
            uint256 expiredBlock,
            OrderStatus status
        )
    {
        Order memory order = _orderOf[orderId];

        require(order.status != OrderStatus.Not_Set, "Order not found");

        // return
        creator = order.creator;
        amount = order.amount;
        expiredBlock = order.expiredBlock;
        status = order.status;
    }

    // SETTERs
    // set max deadline block
    function setMaxBlockExpiration(uint256 max) public ownerOnly
    {
        require(max > 0, "Value must greater than zero");
        _maxBlockExpiration = max;
        emit SetMaxBlockExpirationEvent(msg.sender, max);
    }

    // Create order with
    // valid puzzle
    // value > 0
    // deadline < maxDeadline
    function createOrder(address receiver, bytes32 puzzle, uint256 blockExpiration)
        public
        payable
        runningOnly
        blockExpirationValidOnly(blockExpiration)
    {
        // validate inputs
        require(puzzle != 0, "Invalid Puzzle");
        require(msg.value > 0, "Ether amount must greater than zero");
        require(receiver != address(0x0), "Invalid receiver");

        Order storage newOrder = _orderOf[puzzle];

        require(newOrder.status == OrderStatus.Not_Set, "Puzzle already exist");

        // CREATE
        // expired Block
        uint256 expiredBlock = block.number.add(blockExpiration);

        //create new order
        newOrder.amount= msg.value;
        newOrder.expiredBlock= expiredBlock;
        newOrder.creator= msg.sender;
        newOrder.receiver= receiver;
        newOrder.status= OrderStatus.Available;

        // event
        emit NewOrderEvent(msg.sender, msg.value, expiredBlock, puzzle);
    }

    // Claim order with
    // password
    // status = Available
    // not expire
    function claimOrder(bytes32 password) public runningOnly
    {
        require(password != 0, "Passwords required");
        // generate input puzzle
        bytes32 puzzle = generatePuzzle(msg.sender, password);

        // get order
        Order memory order = _orderOf[puzzle];

        require(order.status == OrderStatus.Available, "Order not available");

        // set status
        _orderOf[puzzle].status = OrderStatus.Claimed;

        // event
        emit ClaimOrderEvent(puzzle, msg.sender, order.amount, password);

        // transfer
        msg.sender.transfer(order.amount);
    }

    // Cancel order with
    // valid order Id
    // status = Available
    // right owner
    function cancelOrder(bytes32 orderId) public runningOnly
    {
        // get order
        Order memory order = _orderOf[orderId];
        require(order.status == OrderStatus.Available, "Order not available");

        require(order.creator == msg.sender,
            "Only order creator to cancel order"
        );

        require(order.status == OrderStatus.Available,
            "Only cancel available order"
        );

        require(block.number > order.expiredBlock,
            "Only cancel expired order"
        );

        _orderOf[orderId].status = OrderStatus.Cancelled;

        // event
        emit CancelOrderEvent(orderId, msg.sender);
        // refund
        msg.sender.transfer(order.amount);
    }

    // generate puzzle
    function generatePuzzle(address receiver, bytes32 password)
        public
        pure
        returns(bytes32 puzzle)
    {
        puzzle = keccak256(
            abi.encodePacked(receiver, password)
        );
    }
}