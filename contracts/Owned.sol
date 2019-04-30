pragma solidity >=0.4.21 <0.6.0;

contract Owned {
  // owner
  address payable private _owner;

  // event
  event OwnerChanged(
    address indexed sender,
    address indexed newOwner
  );

  // constructor
  constructor() public {
    _owner = msg.sender;

    emit OwnerChanged(address(0x0), _owner);
  }

  // modifier
  modifier ownerOnly() {
    require(_owner == msg.sender,
      "Only the owner can call this function!"
    );
    _;
  }

  // getter
  function getOwner() public view returns (address payable) {
    return _owner;
  }

  // change owner
  function changeOwner(address payable newOwner)
    public
    ownerOnly
  {
    require(_owner != newOwner && newOwner != address(0x0),
      "New address must be valid"
    );
    _owner = newOwner;
    emit OwnerChanged(msg.sender, newOwner);
  }
}