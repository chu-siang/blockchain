# BDaF 2026 Lab01

This project implements a secure Ethereum smart contract (EthSmart) that accepts ETH deposits and restricts withdrawals to a single authorized owner, as part of BDaF 2026 Lab01.

## Project Description

The contract is a secure ETH storage vault with the following features:
- Accepts ETH transfers via the `receive()` function
- Emits events for all deposits
- Restricts withdrawals to a single authorized owner address
- Emits events for successful withdrawals and unauthorized attempts
- Prevents overdrawing with balance checks
- Uses secure ETH transfer methods

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- pnpm package manager

### Installation

1. Clone this repository
2. Navigate to the `lab01` directory
3. Install dependencies:

```shell
pnpm install
```

## Test Instructions

To run all tests for the  contract:

```shell
pnpm hardhat test test/EthSmart.ts
```

To run all tests in the project:

```shell
pnpm hardhat test
```

To run only Node.js tests:

```shell
pnpm hardhat test nodejs
```

## Technical Specifications

### Solidity Version
- Solidity ^0.8.28

### Framework Used
- Hardhat 3.x with TypeScript
- Viem for Ethereum interactions
- Node.js native test runner (`node:test`)

## Contract Features

### Events
- `Deposit(address indexed sender, uint256 amount)` - Emitted when ETH is received
- `Weethdraw(address indexed to, uint256 amount)` - Emitted when owner withdraws
- `UnauthorizedWithdrawAttempt(address indexed caller, uint256 amount)` - Emitted when non-owner attempts withdrawal

### Functions
- `constructor(address _owner)` - Sets the authorized withdrawer
- `receive() external payable` - Accepts ETH transfers
- `withdraw(uint256 amount) external` - Allows owner to withdraw ETH
- `getBalance() external view returns (uint256)` - Returns contract balance
- `owner() public view returns (address)` - Returns the owner address

### Security Features
- Immutable owner address
- Balance safety checks
- Safe ETH transfer using `call`
- Checks-effects-interactions pattern
- Non-reverting unauthorized access handling

## Test Coverage

The test suite includes comprehensive coverage across four test groups:

### Test Group A - Deposits
- Single deposit functionality
- Deposit event emission
- Multiple deposits handling
- Different sender support
- Repeated sender handling

### Test Group B - Owner Withdrawal
- Partial amount withdrawal
- Full balance withdrawal
- Withdrawal event emission
- Balance decrease verification

### Test Group C - Unauthorized Withdrawal
- Non-owner prevention
- Unauthorized event emission
- Non-reverting behavior
- Balance preservation

### Test Group D - Edge Cases
- Overdraw prevention
- Zero amount withdrawal
- Multiple deposits before withdrawal
- Empty contract withdrawal
- Sequential withdrawals
