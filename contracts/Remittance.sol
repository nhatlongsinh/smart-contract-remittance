pragma solidity >=0.4.21 <0.6.0;

import './Settings.sol';
import './Data.sol';
import './SafeMath.sol';

contract Remittance is Settings, Data {
    // library
    using SafeMath for uint;

    // PRIVATE VARIABLES
    // list of orders by order Id which is 0, 1, 2, 3
    Order[] private _orderOf;

    // EVENTS
    // new order event
    event NewOrderEvent(
        uint256 indexed orderId,
        address indexed owner,
        bytes32 indexed puzzle,
        uint256 amount,
        uint256 expiredBlock
    );
    // claim order event
    event ClaimOrderEvent(
        uint256 indexed orderId,
        address indexed receiver,
        uint256 amount,
        string password1,
        string password2
    );
    // cancel order event
    event CancelOrderEvent(
        uint256 indexed orderId,
        address indexed owner
    );
    // change puzzle event
    event ChangePuzzleEvent(
        uint256 indexed orderId,
        bytes32 indexed oldPuzzle,
        bytes32 indexed newPuzzle
    );

    // MODIFIER
    modifier validOrderIdOnly(uint256 orderId) {
        require(orderId < _orderOf.length);
        _;
    }

    // constructor
    constructor(bool isRunning, uint256 maxBlockExpiration)
        public
        Settings(isRunning, maxBlockExpiration)
        {}

    // PUBLIC METHODS
    // Get order with
    // valid order id
    function getOrder(uint256 orderId)
        public
        view
        validOrderIdOnly(orderId)
        returns(
            address owner,
            bytes32 puzzle,
            uint256 amount,
            uint256 expiredBlock,
            OrderStatus status
        )
    {
        Order memory order = _orderOf[orderId];
        // return
        owner = order.owner;
        puzzle = order.puzzle;
        amount = order.amount;
        expiredBlock = order.expiredBlock;
        status = order.status;
    }

    // Create order with
    // valid puzzle
    // value >0
    // deadline < maxDeadline
    function createOrder(
        bytes32 puzzle,
        uint256 blockExpiration
    )
        public
        payable
        runningOnly
        blockExpirationValidOnly(blockExpiration)
        returns (uint256 orderId)
    {
        // validate
        require(puzzle != 0 && msg.value > 0);

        // expired Block
        uint256 expiredBlock = block.number.add(blockExpiration);

        //create new order
        Order memory newOrder = Order({
                puzzle: puzzle,
                amount: msg.value,
                expiredBlock: expiredBlock,
                owner: msg.sender,
                status: OrderStatus.Available
            });

        // add order to array and return order id
        orderId = _orderOf.push(newOrder) - 1;

        // event
        emit NewOrderEvent(orderId, msg.sender, puzzle, msg.value, expiredBlock);
    }

    // Claim order with
    // valid puzzle
    // status = Available
    // not expire
    function claimOrder(
        uint256 orderId,
        string memory password1,
        string memory password2
    )
        public
        runningOnly
        validOrderIdOnly(orderId)
    {
        // get order
        Order storage order = _orderOf[orderId];

        // must NOT expired
        require(block.number <= order.expiredBlock);

        // must available
        require(order.status == OrderStatus.Available);

        // valid puzzle
        require(isPuzzleValid(
            password1,
            password2,
            order.puzzle
        ));

        // set status
        order.status = OrderStatus.Claimed;

        // event
        emit ClaimOrderEvent(orderId, msg.sender, order.amount, password1, password2);

        // transfer
        msg.sender.transfer(order.amount);
    }

    // Cancel order with
    // valid order Id
    // status = Available
    // right owner
    function cancelOrder(uint256 orderId)
        public
        runningOnly
        validOrderIdOnly(orderId)
    {
        // get order
        Order storage order = _orderOf[orderId];

        // must expired
        require(block.number > order.expiredBlock);

        // check ownership
        require(isOrderModifiable(order, msg.sender));

        // set status
        order.status = OrderStatus.Cancelled;

        // event
        emit CancelOrderEvent(orderId, msg.sender);
        // refund
        msg.sender.transfer(order.amount);
    }

    // Change Puzzle
    // valid order owner
    // order available
    // order not expire
    function changePuzzle(
        uint256 orderId,
        bytes32 puzzle
    )
        public
        runningOnly
        validOrderIdOnly(orderId)
    {
        // validate
        require(puzzle != 0);
        // get order
        Order storage order = _orderOf[orderId];

        // must NOT expired
        require(block.number <= order.expiredBlock);

        // check ownership
        require(isOrderModifiable(order, msg.sender));

        // change puzzle
        bytes32 oldPuzzle = order.puzzle;
        order.puzzle = puzzle;

        // event
        emit ChangePuzzleEvent(orderId, oldPuzzle, puzzle);
    }

    // validate puzzle
    function isPuzzleValid(
        string memory password1,
        string memory password2,
        bytes32 puzzle
    )
        public
        pure
        returns(bool matched)
    {
        // encrypt
        bytes32 newPuzzle = generatePuzzle(
            password1,
            password2
        );
        // compare
        matched = newPuzzle == puzzle;
    }

    // generate puzzle
    function generatePuzzle(
        string memory password1,
        string memory password2
    )
        public
        pure
        returns(bytes32 puzzle)
    {
        puzzle = keccak256(
            abi.encodePacked(password1, password2)
        );
    }
    
    // PRIVATE METHODS

    // check if msg.sender can modify order
    // only if order is available
    // and order.owner = sender
    function isOrderModifiable(
        Order memory order,
        address sender
    )
        private
        pure
        returns(bool result)
    {
        result = order.status == OrderStatus.Available
            && order.owner == sender;
    }
}