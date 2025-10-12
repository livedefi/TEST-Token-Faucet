// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleToken
 * @dev Production-ready ERC20 token with additional features:
 * - Mintable by owner
 * - Burnable by token holders
 * - Pausable for emergency stops
 * - Ownable for administrative functions
 * - ReentrancyGuard for security
 * - Supply cap to prevent unlimited minting
 */
contract SimpleToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    uint256 public immutable cap;
    
    event Mint(address indexed to, uint256 amount);
    event CapUpdated(uint256 newCap);

    /**
     * @dev Constructor that gives msg.sender all of existing tokens and sets the supply cap
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     * @param initialSupply_ The initial supply of tokens (in wei)
     * @param cap_ The maximum supply cap (in wei)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint256 cap_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(cap_ > 0, "SimpleToken: cap must be greater than 0");
        require(initialSupply_ <= cap_, "SimpleToken: initial supply exceeds cap");
        
        cap = cap_;
        
        if (initialSupply_ > 0) {
            _mint(msg.sender, initialSupply_);
        }
    }

    /**
     * @dev Mints tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner nonReentrant {
        require(to != address(0), "SimpleToken: mint to zero address");
        require(totalSupply() + amount <= cap, "SimpleToken: cap exceeded");
        
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev Batch mint tokens to multiple addresses
     * @param recipients Array of addresses to mint tokens to
     * @param amounts Array of amounts to mint to each address
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(recipients.length == amounts.length, "SimpleToken: arrays length mismatch");
        require(recipients.length > 0, "SimpleToken: empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= cap, "SimpleToken: cap exceeded");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "SimpleToken: mint to zero address");
            _mint(recipients[i], amounts[i]);
            emit Mint(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev Pauses all token transfers
     * Can only be called by the owner
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     * Can only be called by the owner
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Returns the remaining number of tokens that can be minted
     */
    function remainingMintableSupply() public view returns (uint256) {
        return cap - totalSupply();
    }

    /**
     * @dev Hook that is called before any transfer of tokens
     * This includes minting and burning
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }

    /**
     * @dev Emergency function to recover accidentally sent ERC20 tokens
     * @param token The address of the ERC20 token to recover
     * @param amount The amount of tokens to recover
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "SimpleToken: cannot recover own token");
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Emergency function to recover accidentally sent Ether
     */
    function recoverEther() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}