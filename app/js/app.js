const $ = require("jquery");
const Web3 = require("web3");
const remittanceArtifact = require("../../build/contracts/Remittance.json");
const truffleContract = require("truffle-contract");

// gas max
const maxGas = 3000000;

const App = {
  web3: null,
  remittance: null,
  account: null,
  currentProvider: null,
  startApp: async function() {
    try {
      const { web3 } = this;
      // get contract instance
      const RemittanceContract = truffleContract(remittanceArtifact);
      RemittanceContract.setProvider(this.currentProvider);

      this.remittance = await RemittanceContract.deployed();
      const accounts = await web3.eth.getAccounts();
      //check if metamask locked
      if (accounts.length > 0) {
        this.account = accounts[0];
      }
      // check metamask
      this.checkMetamaskAccount();
      // init app events
      this.addAppEvent();
    } catch (error) {
      console.error("Could not connect to contract or chain. " + error);
    }
  },
  submitAssign: function() {
    const { web3, displayAlert, hideAlert, enableApp } = this;
    hideAlert();
    // clear
    $("#lblPuzzle").text("");
    // get data
    const amount = $("#txtAmount").val();
    const receiver = $("#txtReceiver").val();
    const password = $("#txtPassword").val();
    const blockExpiration = $("#txtBlockExpiration").val();
    // validate form
    const validateErrors = [];
    if (amount <= 0) {
      validateErrors.push("amount must be greater than zero");
    }
    if (blockExpiration <= 0 || blockExpiration > 1000) {
      validateErrors.push("block expiration must be from 0 to 1000");
    }
    if (!web3.utils.isAddress(receiver)) {
      validateErrors.push("receiver address invalid");
    }
    if (!password || password.length > 32 || password.length < 10) {
      validateErrors.push("password must be in between 10 and 32 characters");
    }
    // check
    if (validateErrors.length > 0) {
      displayAlert(validateErrors.join(". "), "alert-danger");
      enableApp(true);
    } else {
      const amountWei = web3.utils.toWei(amount);
      const { createOrder, generatePuzzle, getOrder } = this.remittance;
      const { asciiToHex } = this.web3.utils;
      // generate puzzle first

      generatePuzzle
        .call(receiver, asciiToHex(password), {
          from: this.account
        })
        .then(puzzle => {
          $("#lblPuzzle").text(puzzle);
          // get order
          return getOrder.call(puzzle, {
            from: this.account
          });
        })
        .then(order => {
          const puzzle = $("#lblPuzzle").text();
          if (order.creator !== "0x0000000000000000000000000000000000000000") {
            displayAlert("Password already used", "alert-danger");
          } else {
            // test call first
            createOrder
              .call(puzzle, blockExpiration, {
                from: this.account,
                value: amountWei
              })
              .then(() => {
                // Ok, we move onto the real action.
                return (
                  createOrder(puzzle, blockExpiration, {
                    from: this.account,
                    value: amountWei,
                    gas: maxGas
                  })
                    // .createOrder takes time in real life, so we get the txHash immediately while it
                    // is mined.
                    .on("transactionHash", txHash =>
                      $("#assignStatus").html(
                        "Transaction on the way " + txHash
                      )
                    )
                    .on("confirmation", (confirmationNumber, receipt) => {
                      $("#assignStatus").html(
                        confirmationNumber + " confirmation(s)"
                      );
                    })
                );
              })
              //tx mined
              .then(txObj => {
                const receipt = txObj.receipt;
                console.log("got receipt", receipt);
                if (!receipt.status) {
                  console.error("Wrong status");
                  console.error(receipt);
                  $("#assignStatus").html(
                    "There was an error in the tx execution, status not 1"
                  );
                } else if (receipt.logs.length == 0) {
                  console.error("Empty events");
                  console.error(receipt);
                  $("#assignStatus").html(
                    "There was an error in the tx execution, missing expected event"
                  );
                } else {
                  console.log(receipt.logs[0]);
                  $("#assignStatus").html("Transfer executed");
                }
              })
              .catch(e => {
                displayAlert(e.toString(), "alert-danger");
              });
          }
        });
    }
  },
  claimFund: function() {
    const { web3, displayAlert, hideAlert, enableApp } = this;
    hideAlert();
    // clear
    $("#txtPuzzleCreator").text("");
    $("#txtPuzzleAmount").text("");
    $("#txtPuzzleExpiredBlock").text("");
    // validate form
    const validateErrors = [];
    const password = $("#txtPuzzlePassword").val();
    if (!password || password.length > 32 || password.length < 10) {
      validateErrors.push("password must be in between 10 and 32 characters");
    }
    // check
    if (validateErrors.length > 0) {
      displayAlert(validateErrors.join(". "), "alert-danger");
      enableApp(true);
    } else {
      const { getOrder, generatePuzzle, claimOrder } = this.remittance;
      const { fromWei, asciiToHex } = web3.utils;

      // check puzzle
      generatePuzzle
        .call(this.account, asciiToHex(password), {
          from: this.account
        })
        .then(puzzle => {
          // get order
          return getOrder.call(puzzle, {
            from: this.account
          });
        })
        .then(order => {
          $("#txtPuzzleCreator").text(order.creator);
          $("#txtPuzzleAmount").text(fromWei(order.amount));
          $("#txtPuzzleExpiredBlock").text(order.expiredBlock);

          if (order.creator === "0x0000000000000000000000000000000000000000") {
            displayAlert("Order not found", "alert-danger");
          } else if (order.amount <= 0) {
            displayAlert("Order is unavailable", "alert-danger");
          } else {
            // call test
            return (
              claimOrder
                .call(asciiToHex(password), {
                  from: this.account
                })
                .then(() => {
                  // Ok, we move onto the real action.
                  return (
                    claimOrder(asciiToHex(password), {
                      from: this.account,
                      gas: maxGas
                    })
                      // .createOrder takes time in real life, so we get the txHash immediately while it
                      // is mined.
                      .on("transactionHash", txHash =>
                        $("#withdrawStatus").html(
                          "Transaction on the way " + txHash
                        )
                      )
                      .on("confirmation", (confirmationNumber, receipt) => {
                        $("#withdrawStatus").html(
                          confirmationNumber + " confirmation(s)"
                        );
                      })
                  );
                })
                //tx mined
                .then(txObj => {
                  const receipt = txObj.receipt;
                  console.log("got receipt", receipt);
                  if (!receipt.status) {
                    console.error("Wrong status");
                    console.error(receipt);
                    $("#withdrawStatus").html(
                      "There was an error in the tx execution, status not 1"
                    );
                  } else if (receipt.logs.length == 0) {
                    console.error("Empty events");
                    console.error(receipt);
                    $("#withdrawStatus").html(
                      "There was an error in the tx execution, missing expected event"
                    );
                  } else {
                    console.log(receipt.logs[0]);
                    $("#withdrawStatus").html("Transfer executed");
                  }
                })
                .catch(e => {
                  displayAlert(e.toString(), "alert-danger");
                })
            );
          }
        });
    }
  },
  cancelFund: function() {
    const { web3, displayAlert, hideAlert, enableApp } = this;
    hideAlert();
    // clear
    $("#txtPuzzleCreator").text("");
    $("#txtPuzzleAmount").text("");
    $("#txtPuzzleExpiredBlock").text("");
    // validate form
    const validateErrors = [];
    const puzzle = $("#txtPuzzle").val();
    if (!puzzle || puzzle.length > 66 || !puzzle.startsWith("0x")) {
      validateErrors.push("puzzle is invalid");
    }
    // check
    if (validateErrors.length > 0) {
      displayAlert(validateErrors.join(". "), "alert-danger");
      enableApp(true);
    } else {
      const { getOrder, cancelOrder } = this.remittance;
      const { fromWei } = web3.utils;

      // check puzzle
      getOrder
        .call(puzzle, {
          from: this.account
        })
        .then(order => {
          console.log(order);
          $("#txtPuzzleCreator").text(order.creator);
          $("#txtPuzzleAmount").text(fromWei(order.amount));
          $("#txtPuzzleExpiredBlock").text(order.expiredBlock);

          if (order.creator === "0x0000000000000000000000000000000000000000") {
            displayAlert("Order not found", "alert-danger");
          } else if (order.amount <= 0) {
            displayAlert("Order is unavailable", "alert-danger");
          } else if (
            order.creator.toLowerCase() !== this.account.toLowerCase()
          ) {
            console.log(this.account);
            displayAlert("Only Owner can cancel this order", "alert-danger");
          } else {
            // check block expire
            web3.eth.getBlockNumber().then(blockNumber => {
              if (order.expiredBlock > blockNumber) {
                displayAlert(
                  "Order is not expired yet, cannot cancel",
                  "alert-danger"
                );
              } else {
                // call test
                cancelOrder
                  .call(puzzle, {
                    from: this.account
                  })
                  .then(() => {
                    // Ok, we move onto the real action.
                    return (
                      cancelOrder(puzzle, {
                        from: this.account,
                        gas: maxGas
                      })
                        // .cancelOrder takes time in real life, so we get the txHash immediately while it
                        // is mined.
                        .on("transactionHash", txHash =>
                          $("#withdrawStatus").html(
                            "Transaction on the way " + txHash
                          )
                        )
                        .on("confirmation", (confirmationNumber, receipt) => {
                          $("#withdrawStatus").html(
                            confirmationNumber + " confirmation(s)"
                          );
                        })
                    );
                  })
                  //tx mined
                  .then(txObj => {
                    const receipt = txObj.receipt;
                    console.log("got receipt", receipt);
                    if (!receipt.status) {
                      console.error("Wrong status");
                      console.error(receipt);
                      $("#withdrawStatus").html(
                        "There was an error in the tx execution, status not 1"
                      );
                    } else if (receipt.logs.length == 0) {
                      console.error("Empty events");
                      console.error(receipt);
                      $("#withdrawStatus").html(
                        "There was an error in the tx execution, missing expected event"
                      );
                    } else {
                      console.log(receipt.logs[0]);
                      $("#withdrawStatus").html("Transfer executed");
                    }
                  })
                  .catch(e => {
                    displayAlert(e.toString(), "alert-danger");
                  });
              }
            });
          }
        });
    }
  },
  displayAlert: function(message, className) {
    $("#alertContainer")
      .removeClass()
      .html(message)
      .show()
      .addClass(["alert", className]);
  },
  hideAlert: function() {
    $("#alertContainer").hide();
  },
  enableApp: function(enabled) {
    $("#btnAssign").prop("disabled", !enabled);
    $("#btnCheck").prop("disabled", !enabled);
  },
  isMetamaskLogin: function() {
    return this.web3.utils.isAddress(this.account);
  },
  checkMetamaskAccount: function() {
    // hide/show UI base on metamask account
    if (this.isMetamaskLogin()) {
      this.hideAlert();
      this.enableApp(true);
    } else {
      this.enableApp(false);
      this.displayAlert(
        "Please login to metamask to start using",
        "alert-warning"
      );
    }
  },
  addAppEvent: function() {
    // hide/show password
    $("#btnShow").on("click", function() {
      const type = $("#txtPassword").attr("type");
      const newType = type === "text" ? "password" : "text";
      const text = newType === "text" ? "hide" : "show";
      $("#txtPassword").attr("type", newType);
      $("#btnShow").text(text);
    });

    // hide/show puzzle password
    $("#btnPuzzlePWShow").on("click", function() {
      const type = $("#txtPuzzlePassword").attr("type");
      const newType = type === "text" ? "password" : "text";
      const text = newType === "text" ? "hide" : "show";
      $("#txtPuzzlePassword").attr("type", newType);
      $("#btnPuzzlePWShow").text(text);
    });

    // assign fund
    $("#btnAssign").on("click", function() {
      App.submitAssign();
    });

    // claim fund
    $("#btnClaim").on("click", function() {
      App.claimFund();
    });

    // cancel fund
    $("#btnCancel").on("click", function() {
      App.cancelFund();
    });

    // metamask account change event
    window.ethereum.on("accountsChanged", function(accounts) {
      console.log("accountsChanged", accounts[0]);
      App.account = accounts[0];
      App.checkMetamaskAccount();
    });
  }
};
window.App = App;

// load event
window.addEventListener("load", () => {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof window.web3 !== "undefined") {
    // Use Mist/MetaMask's provider
    App.web3 = new Web3(window.web3.currentProvider);
  } else {
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    App.web3 = new Web3(
      new Web3.providers.HttpProvider("http://localhost:7545")
    );
  }
  App.currentProvider = web3.currentProvider;

  App.startApp();
});
