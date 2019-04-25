const Remittance = artifacts.require("./Remittance.sol");
const {
  getEventResult,
  advanceBlock,
  generateMockPuzzle
} = require("./testHelpers");
const {
  orderStatus,
  amountWei,
  blockExpiration,
  maxBlockExpiration,
  maxBlockExpirationNew
} = require("./MockData");

contract("Remittance", accounts => {
  //big number
  const { toBN } = web3.utils;
  //prepare mock data
  let instance;
  const [contractOwner, orderCreator, orderReceiver, newAddress] = accounts;

  const createNewOrder = async (orderReceiver, puzzle, blockExpiration) => {
    const txObj = await instance.createOrder(
      orderReceiver,
      puzzle,
      blockExpiration,
      {
        from: orderCreator,
        value: amountWei
      }
    );
    assert.isTrue(txObj.receipt.status, "Cannot create order");
    return txObj.receipt.status;
  };

  beforeEach(async () => {
    //create contract
    instance = await Remittance.new(true, maxBlockExpiration, {
      from: contractOwner
    });
  });
  // owner test
  it("should allow owner to change owner address", async () => {
    const txObj = await instance.changeOwner(newAddress, {
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ChangeOwnerEvent");
    assert.isDefined(event, "it should emit ChangeOwnerEvent");
    // owner changed
    assert.strictEqual(event.sender, contractOwner, "it should change owner");
    assert.strictEqual(event.newOwner, newAddress, "it should change owner");

    // assert data
    const savedOwner = await instance.getOwner({
      from: contractOwner
    });
    assert.strictEqual(savedOwner, newAddress, "it should change owner");
  });

  // Stoppable
  it("should pause", async () => {
    const txObj = await instance.pause({
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "PauseEvent");
    assert.isDefined(event, "it should emit PauseEvent");
    // running changed
    assert.strictEqual(event.sender, contractOwner, "it should pause");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: contractOwner
    });
    assert.strictEqual(newRunning, false, "it should pause");
  });
  // resume
  it("should resume", async () => {
    // create contract with pause
    instance = await Remittance.new(false, maxBlockExpiration, {
      from: contractOwner
    });

    // resume
    const txObj = await instance.resume({
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");

    // check event
    const event = getEventResult(txObj, "ResumeEvent");
    assert.isDefined(event, "it should emit ResumeEvent");
    // running changed
    assert.strictEqual(event.sender, contractOwner, "it should resume");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: contractOwner
    });
    assert.strictEqual(newRunning, true, "it should resume");
  });

  // set block expiration test
  it("should allow to set block expiration", async () => {
    const txObj = await instance.setMaxBlockExpiration(maxBlockExpirationNew, {
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "SetMaxBlockExpirationEvent");
    assert.isDefined(event, "it should emit SetMaxBlockExpirationEvent");
    // running changed
    assert.strictEqual(
      event.newValue.toString(),
      maxBlockExpirationNew.toString(),
      "it should change max block expiration"
    );

    // assert data
    const newMax = await instance.maxBlockExpiration.call({
      from: contractOwner
    });
    assert.strictEqual(
      newMax.toString(),
      maxBlockExpirationNew.toString(),
      "it should change max block expiration"
    );
  });

  // UNIT TEST SHA
  // generate correct SHA
  it("should generate correct puzzle", async () => {
    // mock
    const mockOrder = generateMockPuzzle(orderReceiver);
    const puzzleContract = await instance.generatePuzzle.call(
      mockOrder.receiver,
      mockOrder.correctPassword
    );
    // test
    assert.strictEqual(mockOrder.puzzle, puzzleContract, "puzzle must match");
  });
  //KILL contract
  it("should kill contract and transfer balance to owner", async () => {
    // add new order
    // mock data
    const mockOrder = generateMockPuzzle(orderReceiver);
    // add new order
    await createNewOrder(mockOrder.receiver, mockOrder.puzzle, blockExpiration);
    // contract balance
    const contractBalance = toBN(await web3.eth.getBalance(instance.address));
    // owner balance
    const ownerBalance = toBN(await web3.eth.getBalance(contractOwner));
    // kill contract
    const txObj = await instance.kill({
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check contract code
    const contractCode = await web3.eth.getCode(instance.address);
    // assert
    // code 0x
    assert.strictEqual(contractCode, "0x", "killed contract code");

    // check balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    // get owner balance after kill
    const ownerBalanceAfter = toBN(await web3.eth.getBalance(contractOwner));
    // calculate received amount
    const ownerReceived = ownerBalanceAfter.add(txCost).sub(ownerBalance);

    // assert ownerReceived = contractBalance
    assert.strictEqual(
      ownerReceived.toString(),
      contractBalance.toString(),
      "owner should received contract balance"
    );
  });

  //CREATE ORDER
  it("should create new order", async () => {
    // new mock data
    const newOrderData = generateMockPuzzle(orderReceiver);
    // new order
    const txObj = await instance.createOrder(
      newOrderData.receiver,
      newOrderData.puzzle,
      blockExpiration,
      {
        from: orderCreator,
        value: amountWei
      }
    );
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "NewOrderEvent");
    assert.isDefined(event, "it should emit NewOrderEvent");
    // expired Block
    const expiredBlock = txObj.receipt.blockNumber + blockExpiration;
    // assert event
    assert.strictEqual(event.sender, orderCreator, "sender");
    assert.strictEqual(event.puzzle, newOrderData.puzzle, "sender");
    assert.strictEqual(event.amount.toString(), amountWei.toString(), "amount");
    assert.strictEqual(
      event.expiredBlock.toString(),
      expiredBlock.toString(),
      "expiredBlock"
    );

    // assert data
    const newOrder = await instance.getOrder.call(newOrderData.puzzle, {
      from: orderCreator
    });
    assert.strictEqual(newOrder.creator, orderCreator, "creator");
    assert.strictEqual(
      newOrder.amount.toString(),
      amountWei.toString(),
      "amount"
    );
    assert.strictEqual(newOrder.status.toString(), orderStatus.Available);
    assert.strictEqual(
      newOrder.expiredBlock.toString(),
      expiredBlock.toString(),
      "expiredBlock"
    );
  });

  // CLAIM ORDER
  // orderReceiver claim fund from mock Order using password1 & password2
  it("should claim order", async () => {
    // mock data
    const mockOrder = generateMockPuzzle(orderReceiver);
    // add new order
    await createNewOrder(mockOrder.receiver, mockOrder.puzzle, blockExpiration);

    // initial balance
    const creatorBalance = toBN(await web3.eth.getBalance(orderReceiver));

    // CLAIM ORDER
    const txObj = await instance.claimOrder(mockOrder.correctPassword, {
      from: mockOrder.receiver
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ClaimOrderEvent");
    assert.isDefined(event, "it should emit ClaimOrderEvent");
    // assert event
    assert.strictEqual(event.orderId, mockOrder.puzzle, "order id");
    assert.strictEqual(event.sender, mockOrder.receiver, "sender");
    assert.strictEqual(event.password, mockOrder.correctPassword, "password");
    assert.strictEqual(event.amount.toString(), amountWei.toString(), "amount");

    // assert data
    const claimedOrder = await instance.getOrder.call(mockOrder.puzzle, {
      from: orderCreator
    });
    // status must be Claimed
    assert.strictEqual(claimedOrder.status.toString(), orderStatus.Claimed);

    // assert balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    //new balance
    const creatorBalanceNew = toBN(await web3.eth.getBalance(orderReceiver));
    // calculate received amount
    const creatorReceived = creatorBalanceNew.add(txCost).sub(creatorBalance);
    // test amount received must be correct
    assert.strictEqual(
      amountWei.toString(),
      creatorReceived.toString(),
      "creator should received " + event.amount.toString()
    );
  });

  // CANCEL ORDER
  // order creator cancel order and get the refund
  it("should cancel order", async () => {
    // mock data
    const mockOrder = generateMockPuzzle(orderReceiver);
    // add new order that expire in the next block
    await createNewOrder(mockOrder.receiver, mockOrder.puzzle, 0);
    // skip 1 block => order will be expired
    await advanceBlock();
    // get initial balance
    const creatorBalance = toBN(await web3.eth.getBalance(orderCreator));
    // CANCEL ORDER
    const txObj = await instance.cancelOrder(mockOrder.puzzle, {
      from: orderCreator
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "CancelOrderEvent");
    assert.isDefined(event, "it should emit CancelOrderEvent");
    // assert event
    assert.strictEqual(event.orderId, mockOrder.puzzle, "orderId");
    assert.strictEqual(event.sender, orderCreator, "owner");

    // assert data
    const CancelledOrder = await instance.getOrder.call(mockOrder.puzzle, {
      from: orderCreator
    });
    // status must be Cancelled
    assert.strictEqual(
      CancelledOrder.status.toString(),
      orderStatus.Cancelled,
      "status"
    );

    // assert balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    //new balance
    const creatorBalanceNew = toBN(await web3.eth.getBalance(orderCreator));
    // calculate received amount
    const creatorReceived = creatorBalanceNew.add(txCost).sub(creatorBalance);
    // test amount received must be correct
    assert.strictEqual(
      amountWei.toString(),
      creatorReceived.toString(),
      "creator should received " + amountWei.toString()
    );
  });
});
