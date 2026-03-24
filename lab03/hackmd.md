# Lab03 — Signature-Based Token Approval (Permit)

> **Course:** Blockchain
> **Network:** Zircuit Garfield Testnet
> **Token contract:** [`0x2ffab9aff667d5c28003c558f33ed43c5b573139`](https://garfield-testnet.zircuit.com/address/0x2ffab9aff667d5c28003c558f33ed43c5b573139)

---

## Overview

In a standard ERC20 flow, Alice must send a transaction (and pay gas) to call `approve()` before anyone can spend her tokens. This lab replaces that with a **gasless off-chain signature**: Alice signs a message with her private key, Bob submits it on-chain by calling `permit()`, and the contract verifies the signature and sets the allowance — Alice never pays gas.

```
Alice (off-chain)          Bob (on-chain)           Contract
     │                         │                       │
     │── signs message ──>     │                       │
     │   (no tx, no gas)       │── permit(sig) ──>     │
     │                         │                       │── verify sig
     │                         │                       │── set allowance
     │                         │── transferFrom() ──>  │
     │                         │                       │── transfer tokens
```

---

## Concepts

### Why are signatures useful in Ethereum?

When a user signs a message, they prove ownership of a private key **without sending a transaction**. This means:

- **No gas required** from the authorizing user — a relayer or counterparty can submit the signature and pay gas instead.
- **Better UX** — one signature can authorize complex multi-step flows in a single click.
- **Gasless meta-transactions** — useful for onboarding new users who don't hold ETH yet.

### What is a replay attack?

A replay attack is when an attacker **rebroadcasts a valid signed message** to repeat an action the signer only intended once.

**Example:**
1. Alice signs a permit: *"Bob may spend 500 PMIT from me"*
2. Bob submits it — allowance is set ✓
3. Attacker captures the same signature and submits it again
4. Without protection: allowance is set *again* — Alice didn't intend this

Replay attacks can also happen **across contracts** (same signature valid on a different deployed contract) or **across chains** (same signature valid on mainnet and testnet).

### How does this contract prevent replay attacks?

Three layers of protection are baked into every signed message:

| Protection | How it works |
|---|---|
| **Nonce** | Each permit increments `nonces[owner]`. Old signatures use a stale nonce and revert. |
| **Deadline** | Signature includes a timestamp. Reverts if `block.timestamp > deadline`. |
| **Contract address** | Signature includes `address(this)`. A signature for contract A is invalid on contract B. |

---

## Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PermitToken is ERC20 {
    mapping(address => uint256) public nonces;

    constructor() ERC20("Permit Token", "PMIT") {
        _mint(msg.sender, 100_000_000 * 10 ** decimals());
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) public {
        require(block.timestamp <= deadline, "PermitToken: expired deadline");
        require(nonce == nonces[owner],      "PermitToken: invalid nonce");

        bytes32 hash = keccak256(abi.encodePacked(
            owner, spender, value, nonce, deadline, address(this)
        ));

        bytes32 message = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer  = ECDSA.recover(message, signature);

        require(signer == owner, "PermitToken: invalid signature");

        nonces[owner]++;
        _approve(owner, spender, value);
    }
}
```

### How `permit()` works step by step

```
1. Check deadline     block.timestamp <= deadline   (reverts if expired)
2. Check nonce        nonce == nonces[owner]         (reverts if replayed)
3. Rebuild hash       keccak256(owner, spender, value, nonce, deadline, address(this))
4. Wrap hash          "\x19Ethereum Signed Message:\n32" + hash
5. Recover signer     ecrecover(wrappedHash, v, r, s)
6. Verify signer      signer == owner               (reverts if wrong key)
7. Increment nonce    nonces[owner]++
8. Set allowance      _approve(owner, spender, value)
```

---

## Signature flow in detail

### Off-chain (TypeScript / viem)

```typescript
// 1. Build the same hash as the contract will build
const hash = keccak256(
  encodePacked(
    ["address", "address", "uint256", "uint256", "uint256", "address"],
    [owner, spender, value, nonce, deadline, tokenAddress]
  )
);

// 2. Sign it — viem automatically prepends the Ethereum prefix
const signature = await alice.signMessage({ message: { raw: hexToBytes(hash) } });
```

> `signMessage` with `raw` bytes adds the prefix
> `"\x19Ethereum Signed Message:\n32"` before hashing and signing.

### On-chain (Solidity)

```solidity
// MessageHashUtils.toEthSignedMessageHash does the same prefix wrapping
bytes32 message = MessageHashUtils.toEthSignedMessageHash(hash);

// ECDSA.recover extracts the signing address from (message, signature)
address signer = ECDSA.recover(message, signature);
```

Both sides produce the same prefixed hash → `recover` returns Alice's address ✓

---

## Demonstrated flow on Zircuit Testnet

| Step | Actor | Action | Tx Hash |
|------|-------|--------|---------|
| 1 | Deployer → Alice | Transfer 1000 PMIT | [`0x0ee413ba...`](https://garfield-testnet.zircuit.com/tx/0x0ee413badd45210df9da78554a923ad582a5c8c314595d4eadf51522a54cc388) |
| 2 | Alice | Signs permit **off-chain** (no tx) | — |
| 3 | Bob | Calls `permit()` with Alice's signature | [`0x35e8dd00...`](https://garfield-testnet.zircuit.com/tx/0x35e8dd001f5c6f8ceae81c786c22003bcb19a142f740e7bd9a67eadd6f3b025d) |
| 4 | Bob | Calls `transferFrom()` — pulls 300 PMIT | [`0xe7d39675...`](https://garfield-testnet.zircuit.com/tx/0xe7d39675b04bd3449de1b7fac7c6f1b07dd2f220afa867ea790907157a10eec7) |

### Result
- Alice started with 1000 PMIT, ends with **700 PMIT**
- Bob started with 0 PMIT, ends with **300 PMIT**
- Alice never paid gas for the approval

---

## Addresses

| Role | Address |
|------|---------|
| Token (PMIT) | `0x2ffab9aff667d5c28003c558f33ed43c5b573139` |
| Alice | `0xe75a53afBbE8926129C97ea6BcE415eF28533E4F` |
| Bob | `0x21C0C9A3fF4CE141c5b61712c36Dc88deeb57718` |

---

## Tests

All 10 test cases pass (`npx hardhat test`):

```
PermitToken
  Basic ERC20
    ✔ should have correct name, symbol, decimals, and total supply
    ✔ deployer should receive all tokens on deployment
  Signature Verification
    ✔ valid signature successfully executes permit
    ✔ signature from wrong signer fails
  Nonce Protection
    ✔ nonce increases after successful permit
    ✔ reusing the same signature fails
  Expiry
    ✔ expired signature fails
  Allowance
    ✔ allowance is correctly updated after permit
    ✔ transferFrom() works after permit
    ✔ transferFrom() fails if permit was not executed

10 passing
```

