pragma solidity >=0.4.21 <0.6.0;

import './Owned.sol';

contract Stoppable is Owned {
  // is running
  bool private _isRunning;

  // event
  event ContractPaused(address sender);
  event ContractResumed(address sender);
  event ContractKilled(address sender);

  // constructor
  constructor(bool isRunning) public {
    _isRunning = isRunning;
  }

  // MODIFIER
  // running
  modifier runningOnly() {
    require(_isRunning, "Contract is paused");
    _;
  }
  
  modifier pauseOnly() {
    require(!_isRunning, "Contract is running");
    _;
  }
  
  // GETTER
  // running
  function isRunning() public view returns (bool) {
    return _isRunning;
  }

  // pause
  function pause()
    public
    ownerOnly
    runningOnly
  {
    _isRunning = false;
    emit ContractPaused(msg.sender);
  }
  // set running
  function resume()
    public
    ownerOnly
    pauseOnly
  {
    _isRunning = true;
    emit ContractResumed(msg.sender);
  }
  // kill
  function kill()
    public
    ownerOnly
    pauseOnly
  {
    emit ContractKilled(msg.sender);
    // send all balance to contract owner
    selfdestruct(getOwner());
  }
}