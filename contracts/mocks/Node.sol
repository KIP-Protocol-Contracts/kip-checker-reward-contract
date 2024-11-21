// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CheckerNode is ERC721, Ownable {
    uint256 private _nextTokenId;
    mapping(address => bool) public minter;

    constructor(address initialOwner)
        ERC721("KIP Checker Node", "Node")
        Ownable(initialOwner)
    {}

    modifier onlyMinter() {
        require(minter[_msgSender()], "Caller is not a minter");
        _;
    }

    function mint(address to) external onlyMinter {
        _nextTokenId++;
        _safeMint(to, _nextTokenId);
    }

    function setMinter(address _address, bool enabled) public onlyOwner {
        minter[_address] = enabled;
    }
}
