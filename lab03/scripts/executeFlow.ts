/**
 * executeFlow.ts
 *
 * Demonstrates the required flow on a live testnet:
 *   1. Alice receives tokens from deployer
 *   2. Alice signs a permit message off-chain
 *   3. Bob submits permit() using Alice's signature
 *   4. Bob calls transferFrom() to pull tokens from Alice
 *
 * Usage:
 *   npx hardhat run scripts/executeFlow.ts --network zircuit
 *
 * Required .env variables:
 *   DEPLOYER_PRIVATE_KEY  – account that owns all tokens after deploy
 *   ALICE_PRIVATE_KEY     – Alice's account
 *   BOB_PRIVATE_KEY       – Bob's account
 *   TOKEN_ADDRESS         – deployed PermitToken address
 */

import { network } from "hardhat";
import { parseEther, keccak256, encodePacked, hexToBytes } from "viem";

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as `0x${string}`;

if (!TOKEN_ADDRESS) {
  throw new Error("TOKEN_ADDRESS env variable is required");
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, alice, bob] = await viem.getWalletClients();

  console.log("Deployer:", deployer.account.address);
  console.log("Alice:   ", alice.account.address);
  console.log("Bob:     ", bob.account.address);
  console.log("Token:   ", TOKEN_ADDRESS);

  const token = await viem.getContractAt("PermitToken", TOKEN_ADDRESS);

  // -----------------------------------------------------------------------
  // Step 1: Alice receives tokens
  // -----------------------------------------------------------------------
  console.log("\n--- Step 1: Transfer tokens to Alice ---");
  const transferAmount = parseEther("1000");
  const transferHash = await token.write.transfer([alice.account.address, transferAmount]);
  await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log("Transfer tx hash:", transferHash);
  console.log(
    "Alice balance:",
    (await token.read.balanceOf([alice.account.address])).toString()
  );

  // -----------------------------------------------------------------------
  // Step 2: Alice signs permit off-chain
  // -----------------------------------------------------------------------
  console.log("\n--- Step 2: Alice signs permit off-chain ---");
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + 3600n; // 1 hour
  const nonce = await token.read.nonces([alice.account.address]);
  const permitAmount = parseEther("500");

  const hash = keccak256(
    encodePacked(
      ["address", "address", "uint256", "uint256", "uint256", "address"],
      [alice.account.address, bob.account.address, permitAmount, nonce, deadline, TOKEN_ADDRESS]
    )
  );

  const signature = await alice.signMessage({ message: { raw: hexToBytes(hash) } });
  console.log("Signature created (off-chain, no tx)");

  // -----------------------------------------------------------------------
  // Step 3: Bob submits permit() on-chain
  // -----------------------------------------------------------------------
  console.log("\n--- Step 3: Bob submits permit() ---");
  const tokenAsBob = await viem.getContractAt("PermitToken", TOKEN_ADDRESS, {
    client: { wallet: bob },
  });

  const permitHash = await tokenAsBob.write.permit([
    alice.account.address,
    bob.account.address,
    permitAmount,
    nonce,
    deadline,
    signature,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: permitHash });
  console.log("Permit tx hash:", permitHash);
  console.log(
    "Allowance (Alice -> Bob):",
    (await token.read.allowance([alice.account.address, bob.account.address])).toString()
  );

  // -----------------------------------------------------------------------
  // Step 4: Bob calls transferFrom()
  // -----------------------------------------------------------------------
  console.log("\n--- Step 4: Bob calls transferFrom() ---");
  const transferFromAmount = parseEther("300");
  const transferFromHash = await tokenAsBob.write.transferFrom([
    alice.account.address,
    bob.account.address,
    transferFromAmount,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: transferFromHash });
  console.log("TransferFrom tx hash:", transferFromHash);
  console.log(
    "Alice balance after:",
    (await token.read.balanceOf([alice.account.address])).toString()
  );
  console.log(
    "Bob balance after:  ",
    (await token.read.balanceOf([bob.account.address])).toString()
  );

  console.log("\n========== FLOW SUMMARY ==========");
  console.log("Alice receives tokens tx:          ", transferHash);
  console.log("Bob submits permit() tx:            ", permitHash);
  console.log("Bob calls transferFrom() tx:        ", transferFromHash);
  console.log("===================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
