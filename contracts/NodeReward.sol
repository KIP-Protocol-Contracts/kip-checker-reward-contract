// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CheckerReward is Ownable {
    using ECDSA for bytes32;

    IERC721 public license_nft;
    IERC20 public cKIP;
    address public fund_address;

    uint256 public withdraw_interval = 2592000; // 30 days;

    mapping(address => bool) private paymaster;
    mapping(uint256 => uint256) private last_withdraw_time;
    mapping(uint256 => uint256) private fines;
    mapping(uint256 => uint256) public claimedAmounts;
    mapping(uint256 => uint256) public withdrawAmounts;

    event PaymasterChanged(address indexed sender, address indexed paymaster, bool enabled);
    event Claimed(address indexed sender, uint256 token_id, uint256 amount, address indexed paymaster);
    event Withdraw(address indexed sender, uint256 token_id, uint256 amount);
    event Penalty(address indexed paymaster, uint256 token_id, uint256 amount);
    

    constructor(address initialOwner, address checkerLicenseAddress, address cKIP_token, address fundAddress) Ownable(initialOwner) {
        license_nft = IERC721(checkerLicenseAddress);
        cKIP = IERC20(cKIP_token);
        fund_address = fundAddress;
    }

    function setPaymaster(address _address, bool enabled) external onlyOwner {
        paymaster[_address] = enabled;
        emit PaymasterChanged(_msgSender(), _address, enabled);
    }

    function setFundAddress(address _address) external onlyOwner {
        fund_address = _address;
    }

    function claim(uint256 token_id, uint256 amount, address _paymaster, bytes memory signature) external {
        require(amount>0, "Amount can't be zero");    
        require(paymaster[_paymaster], "You are't paymaster");    
        require(license_nft.ownerOf(token_id) == _msgSender(), "Caller is not the token owner");
        bytes32 message = keccak256(abi.encode(claimedAmounts[token_id],token_id, amount, _msgSender()));
        address recoveredAddress = message.recover(signature);
        require(recoveredAddress == _paymaster, "Invalid Signature");
        claimedAmounts[token_id] += amount;
        emit Claimed(_msgSender(), token_id, amount, _paymaster);
    }

    function withdraw(uint256 token_id, uint256 amount) external {
        require(last_withdraw_time[token_id]==0 && last_withdraw_time[token_id]+withdraw_interval>block.timestamp, "Can't withdraw yet");    
        require(license_nft.ownerOf(token_id) == _msgSender(), "Caller is not the token owner");
        require(amount>0, "Amount can't be zero");
        require(claimedAmounts[token_id]-fines[token_id]>=withdrawAmounts[token_id]+amount, "You money not enough");
        cKIP.transferFrom(fund_address, _msgSender(), amount);
        last_withdraw_time[token_id] = block.timestamp;
        withdrawAmounts[token_id] += amount;
        emit Withdraw(_msgSender(), token_id, amount);
    }

    function penalty(uint256 token_id, uint256 amount) external {
        require(paymaster[_msgSender()], "You are't paymaster");
        require(amount>0, "Amount can't be zero");
        fines[token_id] += amount;
        emit Penalty(_msgSender(), token_id, amount);
    }
}
