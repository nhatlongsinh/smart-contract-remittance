"use strict";
const { soliditySha3, asciiToHex, padRight } = web3.utils;
/**
 * @param {!Function.<!Promise>} action.
 * @param {!Number | !string | !BigNumber} gasToUse.
 * @returns {!Promise} which throws unless it hit a valid error.
 * https://gist.github.com/xavierlepretre/d5583222fde52ddfbc58b7cfa0d2d0a9#file-expected_exception_testrpc_and_geth-js
 */
const expectedExceptionPromise = (action, gasToUse) => {
  return new Promise(function(resolve, reject) {
    try {
      resolve(action());
    } catch (e) {
      reject(e);
    }
  })
    .then(function(txObj) {
      return typeof txObj === "string"
        ? web3.eth.getTransactionReceiptMined(txObj) // regular tx hash
        : typeof txObj.receipt !== "undefined"
        ? txObj.receipt // truffle-contract function call
        : typeof txObj.transactionHash === "string"
        ? web3.eth.getTransactionReceiptMined(txObj.transactionHash) // deployment
        : txObj; // Unknown last case
    })
    .then(
      function(receipt) {
        // We are in Geth
        if (typeof receipt.status !== "undefined") {
          // Byzantium
          assert.strictEqual(
            parseInt(receipt.status),
            0,
            "should have reverted"
          );
        } else {
          // Pre Byzantium
          assert.equal(
            receipt.gasUsed,
            gasToUse,
            "should have used all the gas"
          );
        }
      },
      function(e) {
        if (
          (e + "").indexOf("invalid JUMP") > -1 ||
          (e + "").indexOf("out of gas") > -1 ||
          (e + "").indexOf("invalid opcode") > -1 ||
          (e + "").indexOf("revert") > -1
        ) {
          // We are in TestRPC
        } else if ((e + "").indexOf("please check your gas amount") > -1) {
          // We are in Geth for a deployment
        } else {
          throw e;
        }
      }
    );
};
/**
 * @param {txtObj} transaction object.
 * @param {eventName} event name to filter.
 * @returns {Event} object.
 */
const getEventResult = (txObj, eventName) => {
  const event = txObj.logs.find(log => log.event === eventName);
  if (event) {
    return event.args;
  } else {
    return undefined;
  }
};
const advanceTime = time => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime()
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;

        return resolve(newBlockHash);
      }
    );
  });
};

const advanceBlocks = async num => {
  for (let i = 0; i < num; i++) {
    await advanceBlock();
  }
};

const takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_snapshot",
        id: new Date().getTime()
      },
      (err, snapshotId) => {
        if (err) {
          return reject(err);
        }
        return resolve(snapshotId);
      }
    );
  });
};

const revertToSnapShot = id => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_revert",
        params: [id],
        id: new Date().getTime()
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};
const advanceTimeAndBlock = async time => {
  await advanceTime(time);
  await advanceBlock();
  return Promise.resolve(web3.eth.getBlock("latest"));
};
const randomString = length => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
const generateMockPuzzle = async (receiver, contractInstance) => {
  // random password
  const correctPassword = padRight(asciiToHex(randomString(32)), 64);
  const wrongPassword = padRight(asciiToHex(randomString(32)), 64);
  // puzzle
  // const puzzle = soliditySha3(
  //   { type: "address", value: receiver },
  //   { type: "bytes32", value: correctPassword }
  // );

  const puzzle = await contractInstance.generatePuzzle.call(
    receiver,
    correctPassword,
    {
      from: receiver
    }
  );

  return {
    correctPassword,
    wrongPassword,
    receiver,
    puzzle
  };
};

module.exports = {
  advanceTime,
  advanceBlock,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapShot,
  getEventResult,
  expectedExceptionPromise,
  randomString,
  generateMockPuzzle,
  advanceBlocks
};
