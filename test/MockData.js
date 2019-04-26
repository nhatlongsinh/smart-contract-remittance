const { toBN, toWei, asciiToHex } = web3.utils;
const amountEther = "0.1365";

module.exports = {
  amountEther,
  amountWei: toBN(toWei(amountEther)),
  blockExpiration: 500,
  maxBlockExpiration: 1000,
  maxBlockExpirationNew: 2000,
  puzzleEmpty: asciiToHex("", 32),
  maxGas: 3000000,
  invalidOrderId: asciiToHex("invalid-order", 32)
};
