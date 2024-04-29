// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract KIPNode is ERC721 {
    constructor() ERC721("KIP License", "KIPNODE") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}