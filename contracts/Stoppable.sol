pragma solidity >=0.4.21 <0.6.0;

import './Owned.sol';

contract Stoppable is Owned {
  // is running
  bool private _isRunning;

  // event
  event PauseEvent(address sender);
  event ResumeEvent(address sender);
  event KillEvent(address sender);

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
  
  // GETTER
  // running
  function isRunning() public view returns (bool) {
    return _isRunning;
  }

  // pause
  function pause()
    public
    ownerOnly
  {
    _isRunning = false;
    emit PauseEvent(msg.sender);
  }
  // set running
  function resume()
    public
    ownerOnly
  {
    _isRunning = true;
    emit ResumeEvent(msg.sender);
  }
  // kill
  function kill()
    public
    ownerOnly
  {
    emit KillEvent(msg.sender);
    // send all balance to contract owner
    selfdestruct(_owner);
  }
}