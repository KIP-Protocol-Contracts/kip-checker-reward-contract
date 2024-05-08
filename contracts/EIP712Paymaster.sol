// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EIP712Paymaster is Ownable {
    // using ECDSA for bytes32;

    mapping(address => bool) public paymaster;

    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_HASH = keccak256("Claim(uint256 claimed,uint256 token_id,uint256 amount,address sender,bytes32 reference_id)");
    bytes32 public constant WITHDRAW_HASH = keccak256("Withdraw(uint256 withdrawn,uint256 token_id,uint256 amount,address sender,bytes32 reference_id)");

    event PaymasterChanged(address indexed paymaster, bool enabled);

    constructor(address initialOwner) Ownable(initialOwner) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version)"),
                keccak256(bytes("KIPNODEREWARD")),
                keccak256(bytes("1"))
            )
        );
    }

    function setPaymaster(address _address, bool enabled) public onlyOwner {
        paymaster[_address] = enabled;
        emit PaymasterChanged(_address, enabled);
    }
}