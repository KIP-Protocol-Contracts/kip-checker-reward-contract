// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KIP is ERC20 {
    constructor(address beneficiary) ERC20("KIP", "KIP") {
        _mint(beneficiary, 10000000000 * 10 ** decimals());
    }
}