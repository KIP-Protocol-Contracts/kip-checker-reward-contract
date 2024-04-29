// SPDX-License-Identifier: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CKIP is ERC20 {
    constructor() ERC20("CKIP", "CKIP") {
        _mint(msg.sender, 1000000000000000000000000000);
    }
}