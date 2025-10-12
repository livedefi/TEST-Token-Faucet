// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TokenFaucet
 * @dev Production-ready token faucet contract for controlled token distribution
 * Features:
 * - Rate limiting with configurable cooldown periods
 * - Maximum tokens per address limits
 * - Pausable for emergency stops
 * - ReentrancyGuard for security
 * - Batch operations for efficiency
 * - Comprehensive access controls
 * - Emergency recovery functions
 */
contract TokenFaucet is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    
    // Faucet configuration
    uint256 public tokensPerRequest;
    uint256 public cooldownTime;
    uint256 public maxTokensPerAddress;
    uint256 public dailyLimit;
    uint256 public totalDistributedToday;
    uint256 public lastResetTime;
    
    // User tracking
    mapping(address => uint256) public lastRequestTime;
    mapping(address => uint256) public totalTokensReceived;
    mapping(address => bool) public blacklisted;
    
    
    // Events
    event TokensRequested(address indexed user, uint256 amount, uint256 timestamp);
    event TokensDeposited(address indexed depositor, uint256 amount);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    event FaucetConfigured(
        uint256 tokensPerRequest,
        uint256 cooldownTime,
        uint256 maxTokensPerAddress,
        uint256 dailyLimit
    );
    event UserBlacklisted(address indexed user, bool status);
    event DailyLimitReset(uint256 newDay, uint256 totalDistributed);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    /**
     * @dev Constructor
     * @param tokenAddress Address of the ERC20 token to distribute
     * @param tokensPerRequest_ Amount of tokens per request
     * @param cooldownTime_ Cooldown period between requests (seconds)
     * @param maxTokensPerAddress_ Maximum tokens per address
     * @param dailyLimit_ Maximum tokens to distribute per day
     */
    constructor(
        address tokenAddress,
        uint256 tokensPerRequest_,
        uint256 cooldownTime_,
        uint256 maxTokensPerAddress_,
        uint256 dailyLimit_
    ) Ownable(msg.sender) {
        require(tokenAddress != address(0), "TokenFaucet: invalid token address");
        require(tokensPerRequest_ > 0, "TokenFaucet: tokens per request must be > 0");
        require(maxTokensPerAddress_ >= tokensPerRequest_, "TokenFaucet: max tokens must be >= tokens per request");
        require(dailyLimit_ >= tokensPerRequest_, "TokenFaucet: daily limit must be >= tokens per request");
        
        token = IERC20(tokenAddress);
        tokensPerRequest = tokensPerRequest_;
        cooldownTime = cooldownTime_;
        maxTokensPerAddress = maxTokensPerAddress_;
        dailyLimit = dailyLimit_;
        lastResetTime = block.timestamp;
        
        emit FaucetConfigured(tokensPerRequest_, cooldownTime_, maxTokensPerAddress_, dailyLimit_);
    }
    
    /**
     * @dev Request tokens from the faucet
     */
    function requestTokens() external nonReentrant whenNotPaused {
        address user = msg.sender;
        
        _validateRequest(user);
        _resetDailyLimitIfNeeded();
        
        require(
            totalDistributedToday + tokensPerRequest <= dailyLimit,
            "TokenFaucet: daily limit exceeded"
        );
        
        require(
            token.balanceOf(address(this)) >= tokensPerRequest,
            "TokenFaucet: insufficient faucet balance"
        );
        
        // Update user records
        lastRequestTime[user] = block.timestamp;
        totalTokensReceived[user] += tokensPerRequest;
        totalDistributedToday += tokensPerRequest;
        
        // Transfer tokens
        token.safeTransfer(user, tokensPerRequest);
        
        emit TokensRequested(user, tokensPerRequest, block.timestamp);
    }

    /**
     * @dev Batch request tokens for multiple users (owner only)
     * @param recipients Array of recipient addresses
     * @param amounts Array of token amounts for each recipient
     */
    function batchDistribute(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(recipients.length == amounts.length, "TokenFaucet: arrays length mismatch");
        require(recipients.length > 0, "TokenFaucet: empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(
            token.balanceOf(address(this)) >= totalAmount,
            "TokenFaucet: insufficient faucet balance"
        );
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "TokenFaucet: invalid recipient");
            require(amounts[i] > 0, "TokenFaucet: invalid amount");
            
            token.safeTransfer(recipients[i], amounts[i]);
            emit TokensRequested(recipients[i], amounts[i], block.timestamp);
        }
    }
    
    /**
     * @dev Deposit tokens to the faucet
     * @param amount Amount of tokens to deposit
     */
    function depositTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "TokenFaucet: amount must be > 0");
        
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokensDeposited(msg.sender, amount);
    }

    /**
     * @dev Withdraw tokens from the faucet (owner only)
     * @param amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "TokenFaucet: amount must be > 0");
        require(
            token.balanceOf(address(this)) >= amount,
            "TokenFaucet: insufficient balance"
        );
        
        token.safeTransfer(owner(), amount);
        emit TokensWithdrawn(owner(), amount);
    }

    /**
     * @dev Configure faucet parameters (owner only)
     */
    function configureFaucet(
        uint256 tokensPerRequest_,
        uint256 cooldownTime_,
        uint256 maxTokensPerAddress_,
        uint256 dailyLimit_
    ) external onlyOwner {
        require(tokensPerRequest_ > 0, "TokenFaucet: tokens per request must be > 0");
        require(maxTokensPerAddress_ >= tokensPerRequest_, "TokenFaucet: max tokens must be >= tokens per request");
        require(dailyLimit_ >= tokensPerRequest_, "TokenFaucet: daily limit must be >= tokens per request");
        
        tokensPerRequest = tokensPerRequest_;
        cooldownTime = cooldownTime_;
        maxTokensPerAddress = maxTokensPerAddress_;
        dailyLimit = dailyLimit_;
        
        emit FaucetConfigured(tokensPerRequest_, cooldownTime_, maxTokensPerAddress_, dailyLimit_);
    }

    /**
     * @dev Pause the faucet (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the faucet (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Set blacklist status for a user (owner only)
     * @param user User address
     * @param status Blacklist status
     */
    function setBlacklisted(address user, bool status) external onlyOwner {
        require(user != address(0), "TokenFaucet: invalid address");
        blacklisted[user] = status;
        emit UserBlacklisted(user, status);
    }

    /**
     * @dev Reset daily limit manually (owner only)
     */
    function resetDailyLimit() external onlyOwner {
        _resetDailyLimit();
    }

    /**
     * @dev Emergency function to recover accidentally sent tokens (owner only)
     * @param tokenAddress Address of the token to recover
     * @param amount Amount to recover
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(0), "TokenFaucet: invalid token address");
        require(amount > 0, "TokenFaucet: amount must be > 0");
        
        IERC20(tokenAddress).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(tokenAddress, amount);
    }

    /**
     * @dev Emergency function to recover accidentally sent Ether (owner only)
     */
    function emergencyWithdrawEther() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "TokenFaucet: no ether to withdraw");
        
        payable(owner()).transfer(balance);
    }

    // View functions
    
    /**
     * @dev Get user information
     * @param user User address
     * @return totalReceived Total tokens received by user
     * @return lastRequest Timestamp of last request
     * @return canRequest Whether user can request tokens now
     * @return timeUntilNextRequest Time until next request is allowed
     */
    function getUserInfo(address user) external view returns (
        uint256 totalReceived,
        uint256 lastRequest,
        bool canRequest,
        uint256 timeUntilNextRequest
    ) {
        totalReceived = totalTokensReceived[user];
        lastRequest = lastRequestTime[user];
        
        uint256 nextRequestTime = lastRequest + cooldownTime;
        canRequest = _canUserRequest(user);
        
        if (block.timestamp < nextRequestTime) {
            timeUntilNextRequest = nextRequestTime - block.timestamp;
        } else {
            timeUntilNextRequest = 0;
        }
    }

    /**
     * @dev Get faucet balance
     */
    function getFaucetBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Get faucet configuration
     */
    function getFaucetConfig() external view returns (
        uint256 tokensPerRequest_,
        uint256 cooldownTime_,
        uint256 maxTokensPerAddress_,
        uint256 dailyLimit_,
        uint256 totalDistributedToday_,
        bool paused_
    ) {
        return (
            tokensPerRequest,
            cooldownTime,
            maxTokensPerAddress,
            dailyLimit,
            totalDistributedToday,
            paused()
        );
    }

    /**
     * @dev Check if user can request tokens
     * @param user User address
     */
    function canUserRequest(address user) external view returns (bool) {
        return _canUserRequest(user);
    }

    // Internal functions

    /**
     * @dev Validate token request
     * @param user User address
     */
    function _validateRequest(address user) internal view {
        require(user == tx.origin, "TokenFaucet: contracts not allowed");
        require(!blacklisted[user], "TokenFaucet: user is blacklisted");
        
        require(
            block.timestamp >= lastRequestTime[user] + cooldownTime,
            "TokenFaucet: cooldown period not met"
        );
        
        require(
            totalTokensReceived[user] + tokensPerRequest <= maxTokensPerAddress,
            "TokenFaucet: max tokens per address exceeded"
        );
    }

    /**
     * @dev Check if user can request tokens (internal)
     * @param user User address
     */
    function _canUserRequest(address user) internal view returns (bool) {
        if (paused() || blacklisted[user]) {
            return false;
        }
        
        if (block.timestamp < lastRequestTime[user] + cooldownTime) {
            return false;
        }
        
        if (totalTokensReceived[user] + tokensPerRequest > maxTokensPerAddress) {
            return false;
        }
        
        if (totalDistributedToday + tokensPerRequest > dailyLimit) {
            return false;
        }
        
        return token.balanceOf(address(this)) >= tokensPerRequest;
    }

    /**
     * @dev Reset daily limit if needed
     */
    function _resetDailyLimitIfNeeded() internal {
        if (block.timestamp >= lastResetTime + 1 days) {
            _resetDailyLimit();
        }
    }

    /**
     * @dev Reset daily limit
     */
    function _resetDailyLimit() internal {
        uint256 previousTotal = totalDistributedToday;
        totalDistributedToday = 0;
        lastResetTime = block.timestamp;
        
        emit DailyLimitReset(block.timestamp, previousTotal);
    }

    /**
     * @dev Receive function to accept Ether (for emergency recovery)
     */
    receive() external payable {}
}