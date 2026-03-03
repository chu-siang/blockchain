// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * @title EthSmart
 * @notice A secure Ethereum smart contract that accepts ETH deposits and restricts withdrawals to a single authorized owner
 * @dev Implements receive() for ETH reception, owner-only withdrawals, and comprehensive event logging
 */
contract EthSmart {
    // The authorized address that can withdraw funds
    address public immutable owner;

    // Events
    event Deposit(address indexed sender, uint256 amount);
    event Weethdraw(address indexed to, uint256 amount);
    event UnauthorizedWithdrawAttempt(address indexed caller, uint256 amount);

    /**
     * @notice Initializes the contract and sets the owner
     * @param _owner The address that will be authorized to withdraw funds
     */
    constructor(address _owner) {
        require(_owner != address(0), "Owner cannot be zero address");
        owner = _owner;
    }

    /**
     * @notice Allows the contract to receive ETH transfers
     * @dev Emits a Deposit event for every ETH transfer received
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws a specified amount of ETH to the owner
     * @dev Only the owner can successfully withdraw. Non-owners trigger an event but don't revert
     * @param amount The amount of ETH to withdraw in wei
     */
    function withdraw(uint256 amount) external {
        // Check if caller is the owner
        if (msg.sender != owner) {
            // Emit event for unauthorized attempt, but don't revert
            emit UnauthorizedWithdrawAttempt(msg.sender, amount);
            return;
        }

        // Check if contract has sufficient balance
        require(address(this).balance >= amount, "Insufficient balance");

        // Emit withdrawal event
        emit Weethdraw(owner, amount);

        // Transfer ETH to owner using call for safety
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Returns the current balance of the contract
     * @return The contract's ETH balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
