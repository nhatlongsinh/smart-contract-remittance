pragma solidity >=0.4.21 <0.6.0;

contract Owned {
  // owner
  address private _owner;

  // event
  event ChangeOwnerEvent(
    address indexed oldOwner,
    address indexed newOwner
  );

  // constructor
  constructor() public {
    _owner = msg.sender;

    emit ChangeOwnerEvent(address(0x0), _owner);
  }

  // modifier
  modifier ownerOnly() {
    require(_owner == msg.sender);
    _;
  }

  // getter
  function getOwner() public view returns (address) {
    return _owner;
  }

  // change owner
  function changeOwner(address newOwner)
    public
    ownerOnly
  {
    require(_owner != newOwner && newOwner != address(0x0));
    _owner = newOwner;
    emit ChangeOwnerEvent(msg.sender, newOwner);
  }
}