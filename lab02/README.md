# Lab02: Peer-to-Peer ERC20 Token Trading

A peer-to-peer ERC20 trading smart contract that allows users to create time-limited trade offers and others to fulfill them before expiry.

---

## Contracts

| Contract | Description |
|----------|-------------|
| **TokenA (ALPHA)** | ERC20 token with 100,000,000 supply, 18 decimals |
| **TokenB (BETA)** | ERC20 token with 100,000,000 supply, 18 decimals |
| **TokenTrade** | Trading contract with 0.1% fee |

### Main Functions

| Function | Description |
|----------|-------------|
| `setupTrade(inputToken, inputAmount, outputAmount, expiry)` | Create a trade offer |
| `settleTrade(id)` | Accept and complete a trade |
| `cancelExpiredTrade(id)` | Return tokens for expired trades |
| `withdrawFee()` | Owner withdraws accumulated fees |

---

## Trading Flow

```
1. Alice calls setupTrade(TokenA, 100, 200, expiry)
   → 100 TokenA transferred to contract

2. Bob calls settleTrade(0)
   → Bob sends 200 TokenB to Alice
   → Bob receives 99.9 TokenA (0.1% fee)

3. Owner calls withdrawFee()
   → Owner receives 0.1 TokenA fee
```

---

## Quick Start

```bash
# 1. Install
cd lab02
pnpm install

# 2. Create .env
cat > .env << 'EOF'
PRIVATE_KEY=<owner_private_key_without_0x>
ALICE_PRIVATE_KEY=<alice_private_key_without_0x>
BOB_PRIVATE_KEY=<bob_private_key_without_0x>
EOF

# 3. Run tests
npx hardhat test

# 4. Bridge ETH from Sepolia to Zircuit
npx tsx scripts/bridge.ts

# 5. Deploy contracts
npx hardhat run scripts/deploy.ts --network zircuit

# 6. Add deployed addresses to .env
# TOKEN_A_ADDRESS=0x...
# TOKEN_B_ADDRESS=0x...
# TOKEN_TRADE_ADDRESS=0x...

# 7. Execute trading flow
npx tsx scripts/executeFullFlow.ts

# 8. Verify contracts
npx hardhat verify sourcify --network zircuit --contract contracts/TokenA.sol:TokenA <TOKEN_A_ADDRESS>
npx hardhat verify sourcify --network zircuit --contract contracts/TokenB.sol:TokenB <TOKEN_B_ADDRESS>
npx hardhat verify sourcify --network zircuit --contract contracts/TokenTrade.sol:TokenTrade <TOKEN_TRADE_ADDRESS> <TOKEN_A_ADDRESS> <TOKEN_B_ADDRESS>
```

---

## .env File

```bash
# Private keys (without 0x prefix)
PRIVATE_KEY=<owner_private_key>
ALICE_PRIVATE_KEY=<alice_private_key>
BOB_PRIVATE_KEY=<bob_private_key>

# Contract addresses (add after deployment, with 0x prefix)
TOKEN_A_ADDRESS=0x...
TOKEN_B_ADDRESS=0x...
TOKEN_TRADE_ADDRESS=0x...
```

---

## Network

**Zircuit Garfield Testnet**
- Chain ID: 48898
- RPC: https://garfield-testnet.zircuit.com
- Explorer: https://explorer.garfield-testnet.zircuit.com
- Bridge: https://bridge.garfield-testnet.zircuit.com

---

## File Structure

```
lab02/
├── contracts/
│   ├── TokenA.sol
│   ├── TokenB.sol
│   └── TokenTrade.sol
├── scripts/
│   ├── deploy.ts
│   ├── bridge.ts
│   └── executeFullFlow.ts
├── test/
│   └── TokenTrade.ts
├── .env
├── hardhat.config.ts
└── README.md
```
