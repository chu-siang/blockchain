# Lab02

A peer-to-peer ERC20 trading smart contract that allows users to create time-limited trade offers and others to fulfill them before expiry.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Contract Explanation](#contract-explanation)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Commands Only)](#quick-start-commands-only)
5. [Step-by-Step Guide](#step-by-step-guide)

---

## Project Overview

This project contains 3 smart contracts:

| Contract | Description |
|----------|-------------|
| **TokenA (ALPHA)** | ERC20 token with 100,000,000 supply and 18 decimals |
| **TokenB (BETA)** | ERC20 token with 100,000,000 supply and 18 decimals |
| **TokenTrade** | Trading contract that allows peer-to-peer token swaps |

### How Trading Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRADING FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Alice has TokenA, wants TokenB                              │
│     ↓                                                           │
│  2. Alice calls setupTrade():                                   │
│     - Sells: 100 TokenA                                         │
│     - Wants: 200 TokenB                                         │
│     - Expiry: 1 hour                                            │
│     - TokenA is transferred to contract                         │
│     ↓                                                           │
│  3. Bob sees the trade offer (Trade ID: 0)                      │
│     ↓                                                           │
│  4. Bob calls settleTrade(0):                                   │
│     - Bob sends 200 TokenB → Alice                              │
│     - Contract sends 99.9 TokenA → Bob (after 0.1% fee)         │
│     - 0.1 TokenA fee stays in contract                          │
│     ↓                                                           │
│  5. Owner calls withdrawFee():                                  │
│     - Owner receives accumulated fees                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contract Explanation

### TokenA.sol & TokenB.sol (ERC20 Tokens)

```solidity
contract TokenA is ERC20 {
    constructor() ERC20("Alpha Token", "ALPHA") {
        _mint(msg.sender, 100_000_000 * 10 ** decimals());
    }
}
```

**What it does:**
- Creates a standard ERC20 token
- Mints 100,000,000 tokens to the deployer
- 18 decimals (standard for ERC20)

### TokenTrade.sol (Trading Contract)

#### Key Variables

```solidity
IERC20 public immutable tokenA;        // First allowed token
IERC20 public immutable tokenB;        // Second allowed token
uint256 public constant FEE_PERCENTAGE = 10;      // 0.1% = 10/10000
uint256 public constant FEE_DENOMINATOR = 10000;
```

#### Trade Structure

```solidity
struct Trade {
    address seller;      // Who created the trade
    address inputToken;  // Token being sold
    uint256 inputAmount; // Amount being sold
    uint256 outputAmount;// Amount wanted in return
    uint256 expiry;      // When trade expires (timestamp)
    bool settled;        // Is trade completed?
}
```

#### Main Functions

| Function | Who Can Call | What It Does |
|----------|--------------|--------------|
| `setupTrade(inputToken, inputAmount, outputAmount, expiry)` | Anyone | Create a new trade offer |
| `settleTrade(id)` | Anyone | Accept and complete a trade |
| `cancelExpiredTrade(id)` | Anyone | Return tokens for expired trades |
| `withdrawFee()` | Owner only | Withdraw accumulated trading fees |

#### Events

```solidity
event TradeCreated(tradeId, seller, inputToken, inputAmount, outputAmount, expiry);
event TradeSettled(tradeId, seller, buyer, inputToken, inputAmount, outputAmount, fee);
event FeeWithdrawn(owner, token, amount);
```

---

## Prerequisites

Before starting, you need:

1. **Node.js** (v18 or higher)
2. **pnpm** (or npm/yarn)
3. **Sepolia ETH** (for bridging to Zircuit)
4. **Private keys** for Owner, Alice, and Bob wallets

---

## Quick Start (Commands Only)

For experienced users, here are just the commands:

```bash
# 1. Install dependencies
cd lab02
pnpm install

# 2. Create .env file
cat > .env << 'EOF'
PRIVATE_KEY=<owner_private_key_without_0x>
ALICE_PRIVATE_KEY=<alice_private_key_without_0x>
BOB_PRIVATE_KEY=<bob_private_key_without_0x>
EOF

# 3. Run tests
npx hardhat test

# 4. Bridge Sepolia ETH to Zircuit (need Sepolia ETH first)
npx tsx scripts/bridge.ts

# 5. Deploy contracts
npx hardhat run scripts/deploy.ts --network zircuit

# 6. Update contract addresses in scripts/executeFullFlow.ts, then run:
npx tsx scripts/executeFullFlow.ts

# 7. Verify contracts
npx hardhat verify sourcify --network zircuit --contract contracts/TokenA.sol:TokenA <TOKEN_A_ADDRESS>
npx hardhat verify sourcify --network zircuit --contract contracts/TokenB.sol:TokenB <TOKEN_B_ADDRESS>
npx hardhat verify sourcify --network zircuit --contract contracts/TokenTrade.sol:TokenTrade <TOKEN_TRADE_ADDRESS> <TOKEN_A_ADDRESS> <TOKEN_B_ADDRESS>
```

---

## Step-by-Step Guide

### Step 1: Install Dependencies

```bash
cd lab02
pnpm install
```

This installs:
- Hardhat (development framework)
- OpenZeppelin contracts (ERC20 implementation)
- Viem (Ethereum library)
- Other dependencies

### Step 2: Create Environment File

Create a `.env` file in the `lab02` folder:

```bash
PRIVATE_KEY=<owner_private_key_without_0x>
ALICE_PRIVATE_KEY=<alice_private_key_without_0x>
BOB_PRIVATE_KEY=<bob_private_key_without_0x>
```

**Important:** Do NOT include `0x` prefix in private keys.

### Step 3: Run Tests

```bash
npx hardhat test
```

Expected output: `24 passing (3 solidity, 21 nodejs)`

### Step 4: Get Testnet ETH

You need ETH on **Zircuit Garfield Testnet** (Chain ID: 48898).

**Option A: Bridge from Sepolia**

If you have Sepolia ETH, run the bridge script:

```bash
npx tsx scripts/bridge.ts
```

This sends 0.04 ETH from Sepolia to Zircuit Garfield testnet.

**Option B: Use Zircuit Bridge UI**

Go to: https://bridge.garfield-testnet.zircuit.com/

### Step 5: Deploy Contracts

```bash
npx hardhat run scripts/deploy.ts --network zircuit
```

**Example Output:**
```
Deploying contracts with account: 0x...

Deploying TokenA...
TokenA deployed to: 0x...

Deploying TokenB...
TokenB deployed to: 0x...

Deploying TokenTrade...
TokenTrade deployed to: 0x...
```

**Save these addresses!** You'll need them for the next step.

### Step 6: Update Contract Addresses

Edit `scripts/executeFullFlow.ts` and update these lines with your deployed addresses:

```typescript
const TOKEN_A_ADDRESS = "0x..." as `0x${string}`;
const TOKEN_B_ADDRESS = "0x..." as `0x${string}`;
const TOKEN_TRADE_ADDRESS = "0x..." as `0x${string}`;
```

### Step 7: Execute Full Trading Flow

```bash
npx tsx scripts/executeFullFlow.ts
```

This script will:
1. Fund Alice and Bob with ETH for gas
2. Transfer TokenA to Alice, TokenB to Bob
3. **Alice sets up trade** (sells 100 TokenA for 200 TokenB)
4. **Bob settles trade** (pays 200 TokenB, receives 99.9 TokenA)
5. **Owner withdraws fee** (receives 0.1 TokenA)

### Step 8: Verify Contracts

```bash
# Verify TokenA
npx hardhat verify sourcify --network zircuit --contract contracts/TokenA.sol:TokenA <TOKEN_A_ADDRESS>

# Verify TokenB
npx hardhat verify sourcify --network zircuit --contract contracts/TokenB.sol:TokenB <TOKEN_B_ADDRESS>

# Verify TokenTrade (needs constructor arguments)
npx hardhat verify sourcify --network zircuit --contract contracts/TokenTrade.sol:TokenTrade <TOKEN_TRADE_ADDRESS> <TOKEN_A_ADDRESS> <TOKEN_B_ADDRESS>
```

---

## Network Info

### Zircuit Garfield Testnet

- **Chain ID:** 48898
- **RPC URL:** https://garfield-testnet.zircuit.com
- **Explorer:** https://explorer.garfield-testnet.zircuit.com

---

## Who Needs Which Private Key?

| Action | Who | Private Key Needed |
|--------|-----|-------------------|
| Deploy contracts | Owner | `PRIVATE_KEY` |
| Bridge ETH | Owner | `PRIVATE_KEY` |
| Setup trade | Alice | `ALICE_PRIVATE_KEY` |
| Settle trade | Bob | `BOB_PRIVATE_KEY` |
| Withdraw fees | Owner | `PRIVATE_KEY` |

---

## Common Issues

### "Insufficient funds"
- You need ETH on Zircuit Garfield testnet
- Run `npx tsx scripts/bridge.ts` to bridge from Sepolia

### "Invalid token"
- Make sure you're using the correct token addresses in `setupTrade()`

### "Trade expired"
- The trade has passed its expiry time
- Create a new trade with a longer expiry

### "Trade already settled"
- Someone else already completed this trade
- Check for other available trades

---

## File Structure

```
lab02/
├── contracts/
│   ├── TokenA.sol          # First ERC20 token
│   ├── TokenB.sol          # Second ERC20 token
│   └── TokenTrade.sol      # Trading contract
├── scripts/
│   ├── deploy.ts           # Deploy all contracts
│   ├── bridge.ts           # Bridge ETH from Sepolia
│   └── executeFullFlow.ts  # Run complete trading flow
├── test/
│   └── TokenTrade.ts       # All tests
├── .env                    # Private keys (DO NOT COMMIT!)
├── hardhat.config.ts       # Hardhat configuration
└── README.md               # This file
```

---

## Running Tests

```bash
# Run all tests
npx hardhat test

# Run only Solidity tests
npx hardhat test solidity

# Run only TypeScript tests
npx hardhat test nodejs
```
