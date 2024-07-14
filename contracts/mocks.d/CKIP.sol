// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CKIP is ERC20 {
    constructor() ERC20("CKIP", "CKIP") {
        _mint(msg.sender, 1000000000000 * 10 ** decimals());
    }

    function mint(address to) external {
        _mint(to, 100000 * 10 ** decimals());
    }
}
