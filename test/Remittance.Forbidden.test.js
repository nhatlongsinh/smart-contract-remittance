const { expectedExceptionPromise } = require("./testHelpers");
const Remittance = artifacts.require("./Remittance.sol");
const { advanceBlock, generateMockPuzzle } = require("./testHelpers");
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

  if (accounts.length < 7) throw Error("Accounts is not enough");

  const [
    contractOwner,
    orderCreator,
    orderReceiver,
    orderReceiver2,
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

  beforeEach(async () => {
    //create contract
    instance = await Remittance.new(true, maxBlockExpiration, {
      from: contractOwner
    });
  });
  // owner test
  it("should forbid to change owner address", () => {
    return expectedExceptionPromise(function() {
      return instance.changeOwner(newAddress, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  // Stoppable
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

  // kill
  it("should forbid to call kill", () => {
    return expectedExceptionPromise(function() {
      return instance.kill({
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  // set block expiration test
  it("should forbid to set block expiration", () => {
    return expectedExceptionPromise(function() {
      return instance.setMaxBlockExpiration(maxBlockExpirationNew, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  // CREATE ORDER
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

  // CLAIM ORDER
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

  it("should forbid to claim order with 'Claimed' status", async () => {
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

  // CANCEL ORDER
  it("should forbid to cancel available order or wrong order id", async () => {
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

    // CANCEL NON EXIST ORDER with wrong order id
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
    await createNewOrder(mockOrder.puzzle, 0);
    // skip 1 block => order expired
    // cancel available order
    await advanceBlock();

    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockOrder.puzzle, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });
});
