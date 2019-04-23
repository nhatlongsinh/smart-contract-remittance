const Remittance = artifacts.require("./Remittance.sol");
const {
  getEventResult,
  advanceBlock,
  expectedExceptionPromise
} = require("./testHelpers");
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
  maxBlockExpirationNew,
  maxGas,
  invalidOrderId,
  puzzleEmpty
} = require("./MockData");

contract("Remittance", accounts => {
  // big number
  const { toBN } = web3.utils;
  // prepare mock data
  // contract
  let instance;
  let mockOrderId;
  // addresses
  const [owner, alice, carol, newAddress, unauthorized] = accounts;

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
  it("should forbid to change owner address", () => {
    return expectedExceptionPromise(function() {
      return instance.changeOwner(newAddress, {
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);
  });

  // switch Pausable test
  it("should forbid to switch pausable", () => {
    return expectedExceptionPromise(function() {
      return instance.switchRunning(true, {
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

  // puzzle must valid
  it("should validate puzzle incorrectly", async () => {
    const matched = await instance.isPuzzleValid(
      password1,
      password2,
      puzzleMockNew
    );
    assert.isTrue(!matched, "should return true");
  });

  // CREATE ORDER
  it("should forbid to create new order with invalid value, max block expiration, puzzle", async () => {
    // zero value
    await expectedExceptionPromise(function() {
      return instance.createOrder(puzzleMock, blockExpiration, {
        from: alice,
        value: 0,
        gas: maxGas
      });
    }, maxGas);
    // over max block expiration
    await expectedExceptionPromise(function() {
      return instance.createOrder(puzzleMock, maxBlockExpiration + 1, {
        from: alice,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);
    // empty puzzle
    await expectedExceptionPromise(function() {
      return instance.createOrder(puzzleEmpty, maxBlockExpiration, {
        from: alice,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);
  });

  // CLAIM ORDER
  it("should forbid to claim order with invalid orderId, password, expired", async () => {
    // invalid order id
    await expectedExceptionPromise(function() {
      return instance.claimOrder(invalidOrderId, password1, password2, {
        from: carol,
        gas: maxGas
      });
    }, maxGas);
    // invalid password1
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrderId, passwordNew, password2, {
        from: carol,
        gas: maxGas
      });
    }, maxGas);
    // invalid password2
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrderId, password1, passwordNew, {
        from: carol,
        gas: maxGas
      });
    }, maxGas);

    // MAKE NEW ORDER
    // with blockExpiration 0
    mockOrderId = await createNewOrder(
      instance,
      alice,
      amountWei,
      puzzleMock,
      0
    );
    // mine 1 block to make the order expired
    await advanceBlock();
    // Now Order is expired
    // claim order
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrderId, password1, password2, {
        from: carol,
        gas: maxGas
      });
    }, maxGas);
  });

  it("should forbid to claim order with invalid status", async () => {
    // CLAIM ORDER
    const txObj = await instance.claimOrder(mockOrderId, password1, password2, {
      from: carol,
      gas: maxGas
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // claim again
    await expectedExceptionPromise(function() {
      return instance.claimOrder(mockOrderId, password1, password2, {
        from: carol,
        gas: maxGas
      });
    }, maxGas);
  });

  // CANCEL ORDER
  it("should forbid to cancel order with invalid order id, order owner", async () => {
    // cancel order is not expired
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockOrderId, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);
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
    // now order expired
    // CANCEL ORDER with wrong order id
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(invalidOrderId, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);
    // CANCEL ORDER with new account
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockOrderId, {
        from: newAddress,
        gas: maxGas
      });
    }, maxGas);
  });

  // CHANGE ORDER PUZZLE
  it("should forbid to change order puzzle", async () => {
    // invalid order id
    await expectedExceptionPromise(function() {
      return instance.changePuzzle(invalidOrderId, puzzleMockNew, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);

    // invalid puzzle
    await expectedExceptionPromise(function() {
      return instance.changePuzzle(mockOrderId, puzzleEmpty, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);

    // invalid order owner
    await expectedExceptionPromise(function() {
      return instance.changePuzzle(mockOrderId, puzzleMockNew, {
        from: newAddress,
        gas: maxGas
      });
    }, maxGas);

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
    // Now order expired
    await expectedExceptionPromise(function() {
      return instance.changePuzzle(mockOrderId, puzzleMockNew, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);
  });
});
