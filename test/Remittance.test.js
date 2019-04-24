const Remittance = artifacts.require("./Remittance.sol");
const { getEventResult, advanceBlock } = require("./testHelpers");
const {
  orderStatus,
  amountWei,
  blockExpiration,
  createNewOrder,
  maxBlockExpiration,
  maxBlockExpirationNew,
  generateMockPuzzle
} = require("./MockData");

contract("Remittance", accounts => {
  // big number
  const { toBN } = web3.utils;
  // prepare mock data
  // contract
  let instance;
  let mockAvailableOrder;
  let mockExpiredOrder;
  // addresses
  const [owner, alice, carol, newAddress] = accounts;

  beforeEach(async () => {
    // mock orders
    mockAvailableOrder = generateMockPuzzle();
    mockExpiredOrder = generateMockPuzzle();
    // create contract
    instance = await Remittance.new(true, maxBlockExpiration, { from: owner });
    // add orders to contract
    // available order
    mockAvailableOrder.orderId = await createNewOrder(
      instance,
      alice,
      carol,
      amountWei,
      mockAvailableOrder.puzzle,
      blockExpiration
    );
    // expired order
    mockExpiredOrder.orderId = await createNewOrder(
      instance,
      alice,
      carol,
      amountWei,
      mockExpiredOrder.puzzle,
      0
    );
    // skip 1 block
    await advanceBlock();
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
    assert.strictEqual(event.sender, owner, "it should change owner");
    assert.strictEqual(event.newOwner, newAddress, "it should change owner");

    // assert data
    const savedOwner = await instance.getOwner({
      from: owner
    });
    assert.strictEqual(savedOwner, newAddress, "it should change owner");
  });

  // Stoppable
  it("should pause", async () => {
    const txObj = await instance.pause({
      from: owner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "PauseEvent");
    assert.isDefined(event, "it should emit PauseEvent");
    // running changed
    assert.strictEqual(event.sender, owner, "it should pause");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: owner
    });
    assert.strictEqual(newRunning, false, "it should pause");
  });
  it("should resume", async () => {
    // create contract with pause
    instance = await Remittance.new(false, maxBlockExpiration, { from: owner });

    // resume
    const txObj = await instance.resume({
      from: owner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");

    // check event
    const event = getEventResult(txObj, "ResumeEvent");
    assert.isDefined(event, "it should emit ResumeEvent");
    // running changed
    assert.strictEqual(event.sender, owner, "it should resume");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: owner
    });
    assert.strictEqual(newRunning, true, "it should resume");
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
      mockAvailableOrder.password1,
      mockAvailableOrder.password2
    );
    // test
    assert.strictEqual(
      mockAvailableOrder.puzzle,
      puzzleContract,
      "puzzle must match"
    );
  });
  // KILL contract
  it("should kill contract and transfer balance to owner", async () => {
    // contract balance
    const contractBalance = toBN(await web3.eth.getBalance(instance.address));
    // owner balance
    const ownerBalance = toBN(await web3.eth.getBalance(owner));
    // kill contract
    const txObj = await instance.kill({
      from: owner
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
    const ownerBalanceAfter = toBN(await web3.eth.getBalance(owner));
    // calculate received amount
    const ownerReceived = ownerBalanceAfter.add(txCost).sub(ownerBalance);

    // assert ownerReceived = contractBalance
    assert.strictEqual(
      ownerReceived.toString(),
      contractBalance.toString(),
      "owner should received contract balance"
    );
  });
  // CREATE ORDER
  it("should create new order", async () => {
    // new mock data
    const newOrderData = generateMockPuzzle();
    // new order
    const txObj = await instance.createOrder(
      carol,
      newOrderData.puzzle,
      blockExpiration,
      {
        from: alice,
        value: amountWei
      }
    );
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
    assert.strictEqual(event.sender, alice, "sender");
    assert.strictEqual(event.amount.toString(), amountWei.toString(), "amount");
    assert.strictEqual(
      event.expiredBlock.toString(),
      expiredBlock.toString(),
      "expiredBlock"
    );

    // assert data
    const newOrder = await instance.getOrder.call(orderId, {
      from: alice
    });
    assert.strictEqual(newOrder.creator, alice, "creator");
    assert.strictEqual(newOrder.puzzle, newOrderData.puzzle, "puzzle");
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
  // carol claim fund from mock Order using password1 & password2
  it("should claim order", async () => {
    // initial balance
    const carolBalance = toBN(await web3.eth.getBalance(carol));

    // CLAIM ORDER
    const txObj = await instance.claimOrder(
      mockAvailableOrder.password1,
      mockAvailableOrder.password2,
      {
        from: carol
      }
    );
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ClaimOrderEvent");
    assert.isDefined(event, "it should emit ClaimOrderEvent");
    // assert event
    assert.strictEqual(event.orderId, mockAvailableOrder.orderId, "order id");
    assert.strictEqual(event.sender, carol, "sender");
    assert.strictEqual(
      event.password1,
      mockAvailableOrder.password1,
      "password1"
    );
    assert.strictEqual(
      event.password2,
      mockAvailableOrder.password2,
      "password2"
    );
    assert.strictEqual(event.amount.toString(), amountWei.toString(), "amount");

    // assert data
    const claimedOrder = await instance.getOrder.call(
      mockAvailableOrder.orderId,
      {
        from: alice
      }
    );
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
    // initial balance
    const aliceBalance = toBN(await web3.eth.getBalance(alice));
    // CANCEL ORDER
    const txObj = await instance.cancelOrder(mockExpiredOrder.orderId, {
      from: alice
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "CancelOrderEvent");
    assert.isDefined(event, "it should emit CancelOrderEvent");
    // assert event
    assert.strictEqual(event.orderId, mockExpiredOrder.orderId, "orderId");
    assert.strictEqual(event.sender, alice, "owner");

    // assert data
    const CancelledOrder = await instance.getOrder.call(
      mockExpiredOrder.orderId,
      {
        from: alice
      }
    );
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
});
