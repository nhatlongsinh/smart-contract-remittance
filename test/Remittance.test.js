const Remittance = artifacts.require("./Remittance.sol");
const {
  getEventResult,
  advanceBlocks,
  generateMockPuzzle,
  expectedExceptionPromise
} = require("./testHelpers");

const {
  amountWei,
  blockExpiration,
  maxBlockExpiration,
  maxBlockExpirationNew,
  maxGas
} = require("./MockData");

contract("Remittance", accounts => {
  //big number
  const { toBN } = web3.utils;
  //prepare mock data
  let instance;

  let contractOwner, orderCreator, orderReceiver, newAddress;

  const createNewOrder = async (puzzle, blockExpiration) => {
    const txObj = await instance.createOrder(puzzle, blockExpiration, {
      from: orderCreator,
      value: amountWei
    });
    assert.isTrue(txObj.receipt.status, "Cannot create order");
    return txObj.receipt.status;
  };

  before(() => {
    assert.isTrue(accounts.length >= 4, "Accounts is not enough");
    [contractOwner, orderCreator, orderReceiver, newAddress] = accounts;
  });
  beforeEach(async () => {
    //create contract
    instance = await Remittance.new(true, maxBlockExpiration, {
      from: contractOwner
    });
  });

  it("should allow owner to change owner address", async () => {
    const txObj = await instance.changeOwner(newAddress, {
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "OwnerChanged");
    assert.isDefined(event, "it should emit OwnerChanged");
    // owner changed
    assert.strictEqual(event.sender, contractOwner, "sender");
    assert.strictEqual(event.newOwner, newAddress, "it should change owner");

    // assert data
    const savedOwner = await instance.getOwner({
      from: contractOwner
    });
    assert.strictEqual(savedOwner, newAddress, "it should change owner");
  });

  it("should pause", async () => {
    const txObj = await instance.pause({
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "ContractPaused");
    assert.isDefined(event, "it should emit ContractPaused");
    // running changed
    assert.strictEqual(event.sender, contractOwner, "it should pause");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: contractOwner
    });
    assert.strictEqual(newRunning, false, "it should pause");

    // mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // cannot call paused function

    await expectedExceptionPromise(function() {
      return instance.createOrder(mockOrder.puzzle, 1, {
        from: contractOwner,
        gas: maxGas
      });
    }, maxGas);
  });

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
    const event = getEventResult(txObj, "ContractResumed");
    assert.isDefined(event, "it should emit ContractResumed");
    // running changed
    assert.strictEqual(event.sender, contractOwner, "it should resume");
    // assert data
    const newRunning = await instance.isRunning.call({
      from: contractOwner
    });
    assert.strictEqual(newRunning, true, "it should resume");
  });

  it("should allow to set block expiration", async () => {
    const txObj = await instance.setMaxBlockExpiration(maxBlockExpirationNew, {
      from: contractOwner
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "MaxBlockExpirationChanged");
    assert.isDefined(event, "it should emit MaxBlockExpirationChanged");
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

  it("should kill contract and transfer balance to owner", async () => {
    // mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);
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

  it("should create new order", async () => {
    // new mock data
    const newOrderData = await generateMockPuzzle(orderReceiver, instance);
    // new order
    const txObj = await instance.createOrder(
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
    const event = getEventResult(txObj, "OrderCreated");
    assert.isDefined(event, "it should emit OrderCreated");
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
    const newOrder = await instance.orders.call(newOrderData.puzzle, {
      from: orderCreator
    });
    assert.strictEqual(newOrder.creator, orderCreator, "creator");
    assert.strictEqual(
      newOrder.amount.toString(),
      amountWei.toString(),
      "amount"
    );
    assert.strictEqual(
      newOrder.expiredBlock.toString(),
      expiredBlock.toString(),
      "expiredBlock"
    );
  });

  it("should claim order", async () => {
    // mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);

    const initialBalance = toBN(await web3.eth.getBalance(orderReceiver));

    // CLAIM ORDER
    const txObj = await instance.claimOrder(mockOrder.correctPassword, {
      from: mockOrder.receiver
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "OrderClaimed");
    assert.isDefined(event, "it should emit OrderClaimed");
    // assert event
    assert.strictEqual(event.puzzle, mockOrder.puzzle, "order id");
    assert.strictEqual(event.sender, mockOrder.receiver, "sender");
    assert.strictEqual(event.password, mockOrder.correctPassword, "password");

    // assert data
    const claimedOrder = await instance.orders.call(mockOrder.puzzle, {
      from: orderCreator
    });
    // amount and expiredblock set to zero
    assert.strictEqual(claimedOrder.amount.toString(), "0", "amount");
    assert.strictEqual(
      claimedOrder.expiredBlock.toString(),
      "0",
      "expiredBlock"
    );

    // assert balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    //new balance
    const creatorBalanceNew = toBN(await web3.eth.getBalance(orderReceiver));
    // expected balance
    const creatorExpectedBalance = initialBalance.sub(txCost).add(amountWei);
    // test amount received must be correct
    assert.strictEqual(
      creatorBalanceNew.toString(),
      creatorExpectedBalance.toString(),
      "New balance should match"
    );
  });

  it("should cancel order", async () => {
    // mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order that expire in the next block
    await createNewOrder(mockOrder.puzzle, 1);
    // skip 2 block => order will be expired
    await advanceBlocks(2);

    const initialBalance = toBN(await web3.eth.getBalance(orderCreator));
    // CANCEL ORDER
    const txObj = await instance.cancelOrder(mockOrder.puzzle, {
      from: orderCreator
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "OrderCancelled");
    assert.isDefined(event, "it should emit OrderCancelled");
    // assert event
    assert.strictEqual(event.puzzle, mockOrder.puzzle, "puzzle");
    assert.strictEqual(event.sender, orderCreator, "owner");

    // assert data
    const cancelledOrder = await instance.orders.call(mockOrder.puzzle, {
      from: orderCreator
    });
    // amount and expiredblock set to zero
    assert.strictEqual(cancelledOrder.amount.toString(), "0", "amount");
    assert.strictEqual(
      cancelledOrder.expiredBlock.toString(),
      "0",
      "expiredBlock"
    );

    // assert balance
    // get transaction gas price
    const tx = await web3.eth.getTransaction(txObj.tx);
    const gasPrice = toBN(tx.gasPrice);
    // transaction cost
    const txCost = toBN(txObj.receipt.gasUsed).mul(gasPrice);
    //new balance
    const creatorBalanceNew = toBN(await web3.eth.getBalance(orderCreator));
    // expected balance
    const creatorExpectedBalance = initialBalance.sub(txCost).add(amountWei);
    // test amount received must be correct
    assert.strictEqual(
      creatorBalanceNew.toString(),
      creatorExpectedBalance.toString(),
      "New balance should match"
    );
  });
});
