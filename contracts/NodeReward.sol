// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
// import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

error AmountIsZero();
error InvalidTokenOwner();
error InvalidTreasurer();
error InvalidPayMaster();
error InvalidAuditor();
error ExpiredSignature();
error InvalidSignature();
error CanNotWithdrawYet01();
error CanNotWithdrawYet02();
error InvalidAmount();
error ArrayLengthsError();

contract NodeReward is Initializable, OwnableUpgradeable, UUPSUpgradeable, PausableUpgradeable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;
    // using MessageHashUtils for bytes32;
    IERC721 public kipNode;
    address public cKIP;
    address public fundAddress;

    uint40 public WITHDRAW_INTERVAL;
    uint40 public CLAIM_INTERVAL;

    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_HASH = keccak256("Claim(uint256 claimed,uint256 token_id,uint256 amount,address sender,uint64 expiration_time,bytes32 reference_id)");
    bytes32 public constant WITHDRAW_HASH = keccak256("Withdraw(uint256 withdrawn,uint256 token_id,uint256 amount,address sender,uint64 expiration_time,bytes32 reference_id)");

    mapping(address => bool) public paymaster;
    mapping(address => bool) public auditor;
    mapping(address => bool) public treasurer;
    mapping(uint256 => uint256) public lastWithdrawTime;
    mapping(uint256 => uint256) public lastClaimTime;
    mapping(uint256 => uint256) public fines;
    mapping(uint256 => uint256) public claimedAmounts;
    mapping(uint256 => uint256) public withdrawAmounts;
    mapping(uint256 => mapping(uint256 => address)) public delegations;

    event PaymasterChanged(address indexed paymaster, bool enabled);
    event AuditorChanged(address indexed auditor, bool enabled);
    event TreasurerChanged(address indexed treasurer, bool enabled);
    event FundAddressChanged(address indexed operator, address indexed _address);
    event WithdrawIntervalChanged(address indexed operator, uint40 newInterval);
    event ClaimIntervalChanged(address indexed operator, uint40 newInterval);
    event DelegationChanged(address indexed tokenOwner, uint256 tokenId, uint256 slot, address indexed delegation);
    event Claimed(address indexed tokenOwner, uint256 tokenId, uint256 amount, address indexed paymaster, bytes32 referenceId, uint256 amountT);
    event Withdraw(address indexed tokenOwner, uint256 tokenId, uint256 amount, address indexed paymaster, bytes32 referenceId, uint256 amountT);
    event Penalty(address indexed paymaster, uint256 tokenId, uint256 amount, bytes32 referenceId, uint256 amountT);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
    
    function initialize(address initialOwner, address kipNodeAddress, address cKIPToken, address _fundAddress) initializer public {
        kipNode = IERC721(kipNodeAddress);
        cKIP = cKIPToken;
        fundAddress = _fundAddress;
        WITHDRAW_INTERVAL = 2592000; // 30 days; 86400 * 30 = 2592000
        CLAIM_INTERVAL = 86400; // 1 days = 86400 / 12 hours = 43200

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("KIPNODEREWARD")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __Pausable_init();
    }

    function getDelegation(uint256 tokenId, uint256 slot) external view returns (address)  {
        return delegations[tokenId][slot];
    }

    function setDelegation(uint256 tokenId, uint256 slot, address _address) public {
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();
        delegations[tokenId][slot] = _address;
        emit DelegationChanged(_msgSender(), tokenId, slot, _address);
    }

    function setFundAddress(address _address) external onlyOwner {
        fundAddress = _address;
        emit FundAddressChanged(_msgSender(), _address);
    }

    function claim(uint256 tokenId, uint256 amount, address _paymaster, bytes32 referenceId, bytes calldata signature, uint64 expiration_time) public whenNotPaused {
        if (amount == 0) revert AmountIsZero();
        if (paymaster[_paymaster] == false) revert InvalidPayMaster();
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();
        if (expiration_time < block.timestamp) revert ExpiredSignature();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(CLAIM_HASH, claimedAmounts[tokenId], tokenId, amount, _msgSender(), expiration_time, referenceId))
            )
        );
        address recoveredAddress = digest.recover(signature);
        if (recoveredAddress != _paymaster) revert InvalidSignature();
        
        uint256 amountT = claimedAmounts[tokenId] += amount;
        lastClaimTime[tokenId] = block.timestamp;
        emit Claimed(_msgSender(), tokenId, amount, _paymaster, referenceId, amountT);
    }

    function withdraw(uint256 tokenId, uint256 amount, address _paymaster, bytes32 referenceId, bytes calldata signature, uint64 expiration_time) public whenNotPaused {
        if (kipNode.ownerOf(tokenId) != _msgSender()) revert InvalidTokenOwner();
        if (treasurer[_paymaster] == false) revert InvalidTreasurer();
        if (expiration_time < block.timestamp) revert ExpiredSignature();
        if (amount == 0) revert AmountIsZero();
        if (lastWithdrawTime[tokenId] != 0) {
            if (lastWithdrawTime[tokenId]+WITHDRAW_INTERVAL > block.timestamp) {
                revert CanNotWithdrawYet01();
            }
        }

        if (claimedAmounts[tokenId]-fines[tokenId] < withdrawAmounts[tokenId]+amount) {
            revert InvalidAmount();
        }

        if (lastClaimTime[tokenId]+CLAIM_INTERVAL > block.timestamp) {
            revert CanNotWithdrawYet02();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(WITHDRAW_HASH, withdrawAmounts[tokenId], tokenId, amount, _msgSender(), expiration_time, referenceId))
            )
        );
        address recoveredAddress = digest.recover(signature);
        if (recoveredAddress != _paymaster) revert InvalidSignature();
        
        lastWithdrawTime[tokenId] = block.timestamp;
        uint256 amountT = withdrawAmounts[tokenId] += amount;
        emit Withdraw(_msgSender(), tokenId, amount, _paymaster, referenceId, amountT);
        IERC20(cKIP).safeTransferFrom(fundAddress, _msgSender(), amount);
    }

    function penalty(uint256 tokenId, uint256 amount, bytes32 referenceId) external {
        if (amount == 0) revert AmountIsZero();
        if (auditor[_msgSender()] == false) revert InvalidAuditor();

        fines[tokenId] += amount;
        emit Penalty(_msgSender(), tokenId, amount, referenceId, fines[tokenId]);
    }

    function setWithdrawInterval(uint40 interval) external onlyOwner {
        WITHDRAW_INTERVAL = interval;
        emit WithdrawIntervalChanged(_msgSender(), interval);
    }

    function setClaimInterval(uint40 interval) external onlyOwner {
        CLAIM_INTERVAL = interval;
        emit ClaimIntervalChanged(_msgSender(), interval);
    }

    function setPaymaster(address _address, bool enabled) external onlyOwner {
        paymaster[_address] = enabled;
        emit PaymasterChanged(_address, enabled);
    }

    function setAuditor(address _address, bool enabled) external onlyOwner {
        auditor[_address] = enabled;
        emit AuditorChanged(_address, enabled);
    }

    function setTreasurer(address _address, bool enabled) external onlyOwner {
        treasurer[_address] = enabled;
        emit TreasurerChanged(_address, enabled);
    }
    
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function batchSetDelegation(
        uint256[] calldata tokenIds,
        uint256[] calldata slots,
        address[] calldata addresses
    ) external {
        if (tokenIds.length != slots.length || tokenIds.length != addresses.length) revert ArrayLengthsError();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            setDelegation(tokenIds[i], slots[i], addresses[i]);
        }
    }

    struct ClaimParams {
        uint256 tokenId;
        uint256 amount;
        address paymaster;
        bytes32 referenceId;
        bytes signature;
        uint64 expiration_time;
    }

    function batchClaim(ClaimParams[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; i++) {
            claim(
                claims[i].tokenId,
                claims[i].amount,
                claims[i].paymaster,
                claims[i].referenceId,
                claims[i].signature,
                claims[i].expiration_time
            );
        }
    }

    struct WithdrawParams {
        uint256 tokenId;
        uint256 amount;
        address paymaster;
        bytes32 referenceId;
        bytes signature;
        uint64 expiration_time;
    }

    function batchWithdraw(WithdrawParams[] calldata withdrawals) external {
        for (uint256 i = 0; i < withdrawals.length; i++) {
            withdraw(
                withdrawals[i].tokenId,
                withdrawals[i].amount,
                withdrawals[i].paymaster,
                withdrawals[i].referenceId,
                withdrawals[i].signature,
                withdrawals[i].expiration_time
            );
        }
    }
}