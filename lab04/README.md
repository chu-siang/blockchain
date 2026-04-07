# Lab04 — Membership Board: Storage vs. Merkle Trees

## How to Compile and Run Tests

```bash
# Install dependencies
pnpm install

# Compile contracts
npx hardhat compile

# Run tests (includes gas profiling output)
npx hardhat test
```

---

## Gas Profiling Results

Gas was measured using `receipt.gasUsed` from transaction receipts and `estimateGas` for view functions.

Batch size used for `batchAddMembers`: **250** (4 batches of 250).

| Action | Gas Used |
|--------|----------|
| `addMember` (single call) | 47,515 |
| `addMember` x1000 (total estimated) | 47,515,000 |
| `batchAddMembers` (all 1,000, batch=250) | 24,792,200 |
| `setMerkleRoot` | 47,272 |
| `verifyMemberByMapping` | 23,989 |
| `verifyMemberByProof` | 35,520 |

---

## Batch Size Experimentation

| Batch Size | Total Gas | Per-Member Gas | Batches |
|------------|-----------|----------------|---------|
| 50 | 25,177,320 | 25,177 | 20 |
| 100 | 24,936,620 | 24,936 | 10 |
| 250 | 24,792,200 | 24,792 | 4 |
| 500 | 24,744,084 | 24,744 | 2 |

---

## Questions

### 1. Storage cost comparison

| Approach | Total Gas |
|----------|-----------|
| `addMember` x1000 | 47,515,000 |
| `batchAddMembers` (batch=250) | 24,792,200 |
| `setMerkleRoot` | 47,272 |

**`setMerkleRoot` is by far the cheapest.** It only writes a single `bytes32` value to storage (one `SSTORE` operation), regardless of how many members exist. The Merkle tree is constructed entirely off-chain, so no per-member storage cost is incurred on-chain.

`batchAddMembers` is cheaper than calling `addMember` 1,000 times because the batch approach avoids the 21,000 gas base transaction cost per call. Each individual `addMember` call pays 21,000 base + ~26,515 execution gas, while `batchAddMembers` amortizes the base cost across all members in a single transaction.

Both mapping-based approaches require 1,000 `SSTORE` operations (writing `false` → `true`), which costs ~20,000 gas each, making them inherently expensive.

### 2. Verification cost comparison

| Method | Gas |
|--------|-----|
| `verifyMemberByMapping` | 23,989 |
| `verifyMemberByProof` | 35,520 |

**Mapping verification is cheaper.** It performs a single `SLOAD` operation to look up `members[_member]`, which is an O(1) storage read (~2,100 gas for a warm slot).

Merkle proof verification is more expensive because it must compute `log2(1000) ≈ 10` hash operations (each `keccak256` call), plus the initial double-hashing of the leaf. Each hashing step involves memory operations and the `KECCAK256` opcode, which accumulates to a higher total gas cost.

### 3. Trade-off analysis

**Prefer mapping when:**
- **Verification is frequent and cost-sensitive:** If the contract itself needs to verify membership in other functions (e.g., gating access), the mapping's cheaper `SLOAD` cost (23,989 vs 35,520 gas) adds up over many calls.
- **The membership list changes frequently:** Updating a mapping is straightforward — just call `addMember()`. With a Merkle tree, any change requires recomputing the entire tree off-chain and updating the root, which adds off-chain complexity.
- **Users should not need to provide proofs:** With mappings, anyone can verify membership by calling the contract directly. Merkle proofs require the verifier to have access to the tree and generate a proof.

**Prefer Merkle tree when:**
- **Registration cost is the bottleneck:** Storing 1,000 members via mapping costs ~24.8M gas, while the Merkle root costs only ~47K gas — a ~525x reduction. For large or infrequently changing lists, this is a massive savings.
- **The member list is managed off-chain:** If a centralized admin maintains the list and only needs to commit it on-chain occasionally (e.g., airdrop allowlists, whitelist sales), the Merkle approach is ideal.
- **Privacy of the full member list matters:** With a Merkle root, the full list is never stored on-chain. Individual members can prove their membership without revealing the entire list. With a mapping, every member address is publicly visible via storage reads.
- **The verifier pays for their own gas:** In scenarios like allowlist minting, the user provides their own proof and pays the gas. The extra ~11K gas per verification is a small price compared to the massive savings on registration.

### 4. Batch size experimentation

| Batch Size | Per-Member Gas |
|------------|----------------|
| 50 | 25,177 |
| 100 | 24,936 |
| 250 | 24,792 |
| 500 | 24,744 |

As batch size increases, per-member gas decreases because the fixed overhead of each transaction (21,000 base gas + function selector decoding + loop setup) is amortized over more members. However, the improvement shows **diminishing returns** — going from 50 to 100 saves ~241 gas/member, while going from 250 to 500 only saves ~48 gas/member.

The **sweet spot is around 250–500**, balancing:
- Gas efficiency (per-member cost flattens out)
- Block gas limit constraints (larger batches risk exceeding the 30M gas limit on mainnet)
- Transaction reliability (smaller batches are less likely to fail)

A batch size of 250 is a practical choice: it achieves most of the gas savings while staying well within block gas limits and requiring only 4 transactions.
