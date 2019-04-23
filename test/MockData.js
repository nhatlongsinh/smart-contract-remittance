const { getEventResult } = require("./testHelpers");
const { toBN, toWei, soliditySha3, fromAscii } = web3.utils;
const amountEther = "0.1365";
const password1 = "abc-333-6667";
const password2 = "llg-3303kd-2js";
const passwordNew = "new-33-d-ds-ew-3";

module.exports = {
  orderStatus: {
    Available: "0",
    Claimed: "1",
    Cancelled: "2"
  },
  amountEther,
  amountWei: toBN(toWei(amountEther)),
  blockExpiration: 500,
  maxBlockExpiration: 1000,
  maxBlockExpirationNew: 2000,
  password1,
  password2,
  passwordNew,
  puzzleMock: soliditySha3(password1, password2),
  puzzleMockNew: soliditySha3(password1, passwordNew),
  puzzleEmpty: fromAscii(""),
  maxGas: 3000000,
  invalidOrderId: 100000,
  createNewOrder: async (
    contractInstance,
    sender,
    amountWei,
    puzzle,
    blockExpiration
  ) => {
    const txObj = await contractInstance.createOrder(puzzle, blockExpiration, {
      from: sender,
      value: amountWei
    });
    // status
    assert.isTrue(txObj.receipt.status, "transaction status must be true");
    // check event
    const event = getEventResult(txObj, "NewOrderEvent");
    assert.isDefined(event, "it should emit NewOrderEvent");
    // order id
    return event.orderId;
  }
};
