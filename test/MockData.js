const { getEventResult, randomString } = require("./testHelpers");
const { toBN, toWei, soliditySha3, asciiToHex, padRight } = web3.utils;
const amountEther = "0.1365";

module.exports = {
  orderStatus: {
    Not_Set: "0",
    Available: "1",
    Claimed: "2",
    Cancelled: "3"
  },
  amountEther,
  amountWei: toBN(toWei(amountEther)),
  blockExpiration: 500,
  maxBlockExpiration: 1000,
  maxBlockExpirationNew: 2000,
  puzzleEmpty: asciiToHex("", 32),
  maxGas: 3000000,
  invalidOrderId: asciiToHex("invalid-order", 32),
  createNewOrder: async (
    contractInstance,
    sender,
    receiver,
    amountWei,
    puzzle,
    blockExpiration
  ) => {
    const txObj = await contractInstance.createOrder(
      receiver,
      puzzle,
      blockExpiration,
      {
        from: sender,
        value: amountWei
      }
    );
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "NewOrderEvent");
    assert.isDefined(event, "it should emit NewOrderEvent");
    // order id
    return event.orderId;
  },
  generateMockPuzzle: () => {
    // random password
    const password1 = padRight(asciiToHex(randomString(32)), 64);
    const password2 = padRight(asciiToHex(randomString(32)), 64);
    const password3 = padRight(asciiToHex(randomString(32)), 64);
    // puzzle
    const puzzle = soliditySha3(
      { type: "bytes32", value: password1 },
      { type: "bytes32", value: password2 }
    );

    return {
      password1,
      password2,
      password3,
      puzzle
    };
  }
};
