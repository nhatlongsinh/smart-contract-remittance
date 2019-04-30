const { expectedExceptionPromise } = require("./testHelpers");
const Remittance = artifacts.require("./Remittance.sol");
const { advanceBlocks, generateMockPuzzle } = require("./testHelpers");
const {
  amountWei,
  blockExpiration,
  maxBlockExpiration,
  maxBlockExpirationNew,
  maxGas,
  puzzleEmpty
} = require("./MockData");

contract("Remittance Forbidden", accounts => {
  //prepare mock data
  let instance;

  const [
    contractOwner,
    orderCreator,
    orderReceiver,
    unauthorized,
    newAddress,
    invalidOrderId
  ] = accounts;

  const createNewOrder = async (puzzle, blockExpiration) => {
    const txObj = await instance.createOrder(puzzle, blockExpiration, {
      from: orderCreator,
      value: amountWei
    });
    assert.isTrue(txObj.receipt.status, "Cannot create order");
    return txObj.receipt.status;
  };
  before(() => {
    assert.isTrue(accounts.length >= 6, "Accounts is not enough");
  });
  beforeEach(async () => {
    //create contract
    instance = await Remittance.new(true, maxBlockExpiration, {
      from: contractOwner
    });
  });

  it("should forbid to change owner address", () => {
    return expectedExceptionPromise(function() {
      return instance.changeOwner(newAddress, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to call stoppable", async () => {
    // pause
    await expectedExceptionPromise(function() {
      return instance.pause({
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
    // resume
    await expectedExceptionPromise(function() {
      return instance.resume({
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to call kill", () => {
    return expectedExceptionPromise(function() {
      return instance.kill({
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to set block expiration", () => {
    return expectedExceptionPromise(function() {
      return instance.setMaxBlockExpiration(maxBlockExpirationNew, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to create new order with existed puzzle", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);
    // create order with the same puzzle
    await expectedExceptionPromise(function() {
      return instance.createOrder(mockOrder.puzzle, blockExpiration, {
        from: newAddress,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to create new order with zero value, > max block expiration, empty puzzle", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // zero value
    await expectedExceptionPromise(function() {
      return instance.createOrder(mockOrder.puzzle, blockExpiration, {
        from: orderCreator,
        value: 0,
        gas: maxGas
      });
    }, maxGas);
    // over max block expiration
    await expectedExceptionPromise(function() {
      return instance.createOrder(mockOrder.puzzle, maxBlockExpiration + 1, {
        from: orderCreator,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);

    // empty puzzle
    await expectedExceptionPromise(function() {
      return instance.createOrder(puzzleEmpty, maxBlockExpiration, {
        from: orderCreator,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to claim order with wrong sender, invalid password", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);

    // wrong sender
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrder.correctPassword, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);

    // invalid password
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrder.wrongPassword, {
        from: mockOrder.receiver,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to claim order with that has zero amount", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);
    // CLAIM ORDER
    const txObj = await instance.claimOrder(mockOrder.correctPassword, {
      from: mockOrder.receiver,
      gas: maxGas
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // claim again
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrder.correctPassword, {
        from: mockOrder.receiver,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to cancel available order or wrong puzzle", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order
    await createNewOrder(mockOrder.puzzle, blockExpiration);
    // cancel available order
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockOrder.puzzle, {
        from: orderCreator,
        gas: maxGas
      });
    }, maxGas);

    // CANCEL NON EXIST ORDER with wrong puzzle
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(invalidOrderId, {
        from: orderCreator,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to cancel order with wrong creator", async () => {
    //mock data
    const mockOrder = await generateMockPuzzle(orderReceiver, instance);
    // add new order that expire in the next block
    await createNewOrder(mockOrder.puzzle, 1);
    // skip 2 block => order expired
    // cancel available order
    await advanceBlocks(2);

    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockOrder.puzzle, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });
});
