const Remittance = artifacts.require("./Remittance.sol");
const { getEventResult, advanceBlock } = require("./testHelpers");
const {
  orderStatus,
  amountWei,
  blockExpiration,
  password1,
  password2,
  passwordNew,
  puzzleMock,
  puzzleMockNew,
  createNewOrder,
  maxBlockExpiration,
  maxBlockExpirationNew
} = require("./MockData");

contract("Remittance", accounts => {
  // big number
  const { toBN } = web3.utils;
  // prepare mock data
  // contract
  let instance;
  let mockOrderId;
  // addresses
  const [owner, alice, carol, newAddress] = accounts;

  beforeEach(async () => {
    // create contract
    instance = await Remittance.new(true, maxBlockExpiration, { from: owner });
    // add 1 mock order
    mockOrderId = await createNewOrder(
      instance,
      alice,
      amountWei,
      puzzleMock,
      blockExpiration
    );
  });
  // owner test
  it("should allow owner to change owner address", async () => {
    const txObj = await instance.changeOwner(newAddress, {
      from: owner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ChangeOwnerEvent");
    assert.isDefined(event, "it should emit ChangeOwnerEvent");
    // owner changed
    assert.strictEqual(event.oldOwner, owner, "it should change owner");
    assert.strictEqual(event.newOwner, newAddress, "it should change owner");

    // assert data
    const savedOwner = await instance.getOwner({
      from: owner
    });
    assert.strictEqual(savedOwner, newAddress, "it should change owner");
  });

  // switch Pausable test
  it("should allow to switch pausable", async () => {
    const isRunning = false;
    const txObj = await instance.switchRunning(isRunning, {
      from: owner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "SwitchRunningEvent");
    assert.isDefined(event, "it should emit SwitchRunningEvent");
    // running changed
    assert.strictEqual(event.newValue, isRunning, "it should change pausable");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: owner
    });
    assert.strictEqual(newRunning, isRunning, "it should change pausable");
  });

  // set block expiration test
  it("should allow to set block expiration", async () => {
    const txObj = await instance.setMaxBlockExpiration(maxBlockExpirationNew, {
      from: owner
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
      from: owner
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
    const puzzleContract = await instance.generatePuzzle.call(
      password1,
      password2
    );
    // test
    assert.strictEqual(puzzleMock, puzzleContract, "puzzle must match");
  });
  // puzzle must valid
  it("should validate puzzle correctly", async () => {
    const matched = await instance.isPuzzleValid.call(
      password1,
      password2,
      puzzleMock
    );
    assert.isTrue(matched, "should return true");
  });

  // CREATE ORDER
  it("should create new order", async () => {
    const txObj = await instance.createOrder(puzzleMock, blockExpiration, {
      from: alice,
      value: amountWei
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "NewOrderEvent");
    assert.isDefined(event, "it should emit NewOrderEvent");
    // order id
    const orderId = event.orderId;
    // expired Block
    const expiredBlock = txObj.receipt.blockNumber + blockExpiration;
    // assert event
    assert.strictEqual(event.owner, alice);
    assert.strictEqual(event.puzzle, puzzleMock);
    assert.strictEqual(event.amount.toString(), amountWei.toString());
    assert.strictEqual(event.expiredBlock.toString(), expiredBlock.toString());

    // assert data
    const newOrder = await instance.getOrder.call(orderId, {
      from: alice
    });
    assert.strictEqual(newOrder.owner, alice);
    assert.strictEqual(newOrder.puzzle, puzzleMock);
    assert.strictEqual(newOrder.amount.toString(), amountWei.toString());
    assert.strictEqual(newOrder.status.toString(), orderStatus.Available);
    assert.strictEqual(
      newOrder.expiredBlock.toString(),
      expiredBlock.toString()
    );
  });

  // CLAIM ORDER
  // carol claim fund from mock Order using password1 & password2
  it("should claim order", async () => {
    // initial balance
    const carolBalance = toBN(await web3.eth.getBalance(carol));

    // CLAIM ORDER
    const txObj = await instance.claimOrder(mockOrderId, password1, password2, {
      from: carol
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ClaimOrderEvent");
    assert.isDefined(event, "it should emit ClaimOrderEvent");
    // assert event
    assert.strictEqual(event.orderId.toString(), mockOrderId.toString());
    assert.strictEqual(event.receiver, carol);
    assert.strictEqual(event.password1, password1);
    assert.strictEqual(event.password2, password2);
    assert.strictEqual(event.amount.toString(), amountWei.toString());

    // assert data
    const claimedOrder = await instance.getOrder.call(mockOrderId, {
      from: alice
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
    const carolBalanceNew = toBN(await web3.eth.getBalance(carol));
    // calculate received amount
    const carolReceived = carolBalanceNew.add(txCost).sub(carolBalance);
    // test amount received must be correct
    assert.strictEqual(
      amountWei.toString(),
      carolReceived.toString(),
      "carol should received " + event.amount.toString()
    );
  });

  // CANCEL ORDER
  // alice cancel order and get the refund
  it("should cancel order", async () => {
    // MAKE NEW ORDER
    // with blockExpiration 0
    mockOrderId = await createNewOrder(
      instance,
      alice,
      amountWei,
      puzzleMock,
      0
    );
    // initial balance
    const aliceBalance = toBN(await web3.eth.getBalance(alice));
    // mine 1 block to make the order expired
    await advanceBlock();
    // CANCEL ORDER
    const txObj = await instance.cancelOrder(mockOrderId, {
      from: alice
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "CancelOrderEvent");
    assert.isDefined(event, "it should emit CancelOrderEvent");
    // assert event
    assert.strictEqual(event.orderId.toString(), mockOrderId.toString());
    assert.strictEqual(event.owner, alice);

    // assert data
    const CancelledOrder = await instance.getOrder.call(mockOrderId, {
      from: alice
    });
    // status must be Cancelled
    assert.strictEqual(CancelledOrder.status.toString(), orderStatus.Cancelled);

    // assert balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    //new balance
    const aliceBalanceNew = toBN(await web3.eth.getBalance(alice));
    // calculate received amount
    const aliceReceived = aliceBalanceNew.add(txCost).sub(aliceBalance);
    // test amount received must be correct
    assert.strictEqual(
      amountWei.toString(),
      aliceReceived.toString(),
      "alice should received " + amountWei.toString()
    );
  });

  // CHANGE ORDER PUZZLE
  it("should change order puzzle", async () => {
    const txObj = await instance.changePuzzle(mockOrderId, puzzleMockNew, {
      from: alice
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ChangePuzzleEvent");
    assert.isDefined(event, "it should emit ChangePuzzleEvent");
    // assert event
    assert.strictEqual(event.orderId.toString(), mockOrderId.toString());
    assert.strictEqual(event.oldPuzzle, puzzleMock);
    assert.strictEqual(event.newPuzzle, puzzleMockNew);

    // assert data
    const newOrder = await instance.getOrder.call(mockOrderId, {
      from: alice
    });
    assert.strictEqual(newOrder.puzzle, puzzleMockNew);

    // new puzzle must be valid
    const matched = await instance.isPuzzleValid.call(
      password1,
      passwordNew,
      puzzleMockNew
    );
    assert.isTrue(matched, "should return true");
  });
});
