pragma solidity >=0.4.21 <0.6.0;

import './Owned.sol';

contract Settings is Owned {
  // is running
  bool private _isRunning;
  // maximum number of blocks
  // limit to how far in the future the deadline can be 
  uint256 private _maxBlockExpiration;

  // event
  event SwitchRunningEvent(bool oldValue, bool newValue);
  event SetMaxBlockExpirationEvent(
    uint256 oldValue,
    uint256 newValue
  );

  // constructor
  constructor(bool isRunning, uint256 maxBlockExpiration) public {
    _isRunning = isRunning;
    _maxBlockExpiration = maxBlockExpiration;
  }

  // MODIFIER
  // running
  modifier runningOnly() {
    require(_isRunning);
    _;
  }
  // block expiration
  modifier blockExpirationValidOnly(
    uint256 maxBlockExpiration
  )
  {
    require(maxBlockExpiration <= _maxBlockExpiration);
    _;
  }
  
  // GETTER
  // running
  function isRunning() public view returns (bool) {
    return _isRunning;
  }
  // max block expiration
  function maxBlockExpiration() public view returns (uint256) {
    return _maxBlockExpiration;
  }

  // set running
  function switchRunning(bool running)
    public
    ownerOnly
  {
    bool oldValue = _isRunning;
    _isRunning = running;
    emit SwitchRunningEvent(oldValue, running);
  }

  // set max deadline block
  function setMaxBlockExpiration(uint256 max)
    public
    ownerOnly
  {
    require(max > 0 && max != _maxBlockExpiration);
    uint256 oldValue = _maxBlockExpiration;
    _maxBlockExpiration = max;
    emit SetMaxBlockExpirationEvent(oldValue, max);
  }
}