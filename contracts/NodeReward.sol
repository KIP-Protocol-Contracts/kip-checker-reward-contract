// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./EIP712Paymaster.sol";

error AmountIsZero();
error InvalidTokenOwner();
error InvalidPayMaster();
error InvalidSignature();
error CanNotWithdrawYet();
error InvalidAmount();

// import "hardhat/console.sol";

contract NodeReward is EIP712Paymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC721 public kipNode;
    IERC20 public cKIP;
    address public fundAddress;

    uint256 public constant WITHDRAW_INTERVAL = 2592000; // 30 days;

    // mapping(address => bool) private paymaster;
    mapping(uint256 => uint256) private lastWithdrawTime;
    mapping(uint256 => uint256) private fines;
    mapping(uint256 => uint256) public claimedAmounts;
    mapping(uint256 => uint256) public withdrawAmounts;
    mapping(uint256 => address) public delegations;

    event FundAddressChanged(address indexed operator, address indexed _address);
    event DelegationChanged(address indexed tokenOwner, uint256 tokenId, address indexed delegation);
    event Claimed(address indexed tokenOwner, uint256 tokenId, uint256 amount, address indexed paymaster, bytes32 referenceId);
    event Withdraw(address indexed tokenOwner, uint256 tokenId, uint256 amount);
    event Penalty(address indexed paymaster, uint256 tokenId, uint256 amount, bytes32 referenceId);
    
    constructor(address initialOwner, address kipNodeAddress, address cKIPToken, address _fundAddress, address _paymaster) EIP712Paymaster(initialOwner) {
        kipNode = IERC721(kipNodeAddress);
        cKIP = IERC20(cKIPToken);
        fundAddress = _fundAddress;
        setPaymaster(_paymaster,true);
    }

    function getDelegation(uint256 tokenId) external view returns (address)  {
        return delegations[tokenId];
    }

    function setDelegation(uint256 tokenId, address _address) external {
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();
        delegations[tokenId] = _address;
        emit DelegationChanged(_msgSender(), tokenId, _address);
    }

    function setFundAddress(address _address) external onlyOwner {
        fundAddress = _address;
        emit FundAddressChanged(_msgSender(), _address);
    }

    function claim(uint256 tokenId, uint256 amount, address _paymaster, bytes32 referenceId, bytes calldata signature) external {
        if (amount == 0) revert AmountIsZero();
        if (paymaster[_paymaster] == false) revert InvalidPayMaster();
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(CLAIM_HASH, claimedAmounts[tokenId], tokenId, amount, _msgSender(), referenceId))
            )
        );
        address recoveredAddress = digest.recover(signature);
        if (recoveredAddress != _paymaster) revert InvalidSignature();
        
        claimedAmounts[tokenId] += amount;
        emit Claimed(_msgSender(), tokenId, amount, _paymaster, referenceId);
    }

    function withdraw(uint256 tokenId, uint256 amount, address _paymaster, bytes32 referenceId, bytes calldata signature) external {
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();
        if (paymaster[_paymaster] == false) revert InvalidPayMaster();
        if (amount == 0) revert AmountIsZero();
        if (lastWithdrawTime[tokenId] != 0) {
            if (lastWithdrawTime[tokenId]+WITHDRAW_INTERVAL <= block.timestamp) {
                revert CanNotWithdrawYet();
            }
        }

        if (claimedAmounts[tokenId]-fines[tokenId] <= withdrawAmounts[tokenId]+amount) {
            revert InvalidAmount();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(WITHDRAW_HASH, claimedAmounts[tokenId], tokenId, amount, _msgSender(), referenceId))
            )
        );
        address recoveredAddress = digest.recover(signature);
        if (recoveredAddress != _paymaster) revert InvalidSignature();
        
        lastWithdrawTime[tokenId] = block.timestamp;
        withdrawAmounts[tokenId] += amount;
        
        emit Withdraw(_msgSender(), tokenId, amount);
        require(cKIP.transferFrom(fundAddress, _msgSender(), amount), "Transfer failed");
    }

    function penalty(uint256 tokenId, uint256 amount, bytes32 referenceId) external {
        if (amount == 0) revert AmountIsZero();
        if (paymaster[_msgSender()] == false) revert InvalidPayMaster();

        fines[tokenId] += amount;
        emit Penalty(_msgSender(), tokenId, amount, referenceId);
    }
}
