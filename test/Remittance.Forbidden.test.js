const Remittance = artifacts.require("./Remittance.sol");
const { advanceBlock, expectedExceptionPromise } = require("./testHelpers");
const {
  amountWei,
  blockExpiration,
  createNewOrder,
  maxBlockExpiration,
  maxBlockExpirationNew,
  maxGas,
  invalidOrderId,
  puzzleEmpty,
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
  // alice is order creator
  // carol is order receiver who uses passwords to collect fund
  const [owner, alice, carol, newAddress, unauthorized] = accounts;

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
    await expectedExceptionPromise(function() {
      return instance.pause({
        from: unauthorized,
        gas: maxGas
      });
    }, maxGas);

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
  it("should forbid to create new order with invalid value, max block expiration, puzzle", async () => {
    // use existing puzzle
    await expectedExceptionPromise(function() {
      return instance.createOrder(
        carol,
        mockAvailableOrder.puzzle,
        blockExpiration,
        {
          from: alice,
          value: amountWei,
          gas: maxGas
        }
      );
    }, maxGas);

    // new mock data
    const newOrderData = generateMockPuzzle();
    // zero value
    await expectedExceptionPromise(function() {
      return instance.createOrder(carol, newOrderData.puzzle, blockExpiration, {
        from: alice,
        value: 0,
        gas: maxGas
      });
    }, maxGas);
    // over max block expiration
    await expectedExceptionPromise(function() {
      return instance.createOrder(
        carol,
        newOrderData.puzzle,
        maxBlockExpiration + 1,
        {
          from: alice,
          value: amountWei,
          gas: maxGas
        }
      );
    }, maxGas);
    // empty puzzle
    await expectedExceptionPromise(function() {
      return instance.createOrder(carol, puzzleEmpty, maxBlockExpiration, {
        from: alice,
        value: amountWei,
        gas: maxGas
      });
    }, maxGas);
  });

  // CLAIM ORDER
  it("should forbid to claim order with invalid password", async () => {
    // wrong sender
    await expectedExceptionPromise(function() {
      return instance.claimOrder(
        mockAvailableOrder.password1,
        mockAvailableOrder.password2,
        {
          from: unauthorized,
          gas: maxGas
        }
      );
    }, maxGas);
    // invalid password1
    await expectedExceptionPromise(function() {
      return instance.claimOrder(
        mockAvailableOrder.password3,
        mockAvailableOrder.password2,
        {
          from: carol,
          gas: maxGas
        }
      );
    }, maxGas);
    // invalid password2
    await expectedExceptionPromise(function() {
      return instance.claimOrder(
        mockAvailableOrder.password1,
        mockAvailableOrder.password3,
        {
          from: carol,
          gas: maxGas
        }
      );
    }, maxGas);
  });

  it("should forbid to claim order with 'Claimed' status", async () => {
    // CLAIM ORDER
    const txObj = await instance.claimOrder(
      mockAvailableOrder.password1,
      mockAvailableOrder.password2,
      {
        from: carol,
        gas: maxGas
      }
    );
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // claim again
    await expectedExceptionPromise(function() {
      return instance.claimOrder(
        mockAvailableOrder.password1,
        mockAvailableOrder.password2,
        {
          from: carol,
          gas: maxGas
        }
      );
    }, maxGas);
  });

  // CANCEL ORDER
  it("should forbid to cancel order with invalid order id, order owner", async () => {
    const newOrderData = generateMockPuzzle();
    // cancel available order
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockAvailableOrder.orderId, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);

    // CANCEL NON EXIST ORDER with wrong order id
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(invalidOrderId, {
        from: alice,
        gas: maxGas
      });
    }, maxGas);

    // CANCEL EXPIRED ORDER with new account
    await expectedExceptionPromise(function() {
      return instance.cancelOrder(mockExpiredOrder.orderId, {
        from: newAddress,
        gas: maxGas
      });
    }, maxGas);
  });
});
