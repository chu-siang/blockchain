import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Contract addresses from deployment
const TOKEN_A_ADDRESS = "0x155a5a762b7163e4270db8899b82bb81b7fa3bdb" as `0x${string}`;
const TOKEN_B_ADDRESS = "0x79ba1ef4481627da7860dafd57fd790230a16e0a" as `0x${string}`;
const TOKEN_TRADE_ADDRESS = "0x1f993aab8b432a9c792c9a953cc16c5b7d95a951" as `0x${string}`;

// Addresses
const ALICE_ADDRESS = "0xe75a53afBbE8926129C97ea6BcE415eF28533E4F" as `0x${string}`;
const BOB_ADDRESS = "0x21C0C9A3fF4CE141c5b61712c36Dc88deeb57718" as `0x${string}`;

// Zircuit Garfield Testnet config
const zircuitGarfield = {
  id: 48898,
  name: "Zircuit Garfield Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://garfield-testnet.zircuit.com"] },
  },
  blockExplorers: {
    default: { name: "Zircuit Explorer", url: "https://explorer.garfield-testnet.zircuit.com" },
  },
} as const;

// ERC20 ABI (minimal)
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// TokenTrade ABI (minimal)
const TOKEN_TRADE_ABI = [
  {
    name: "setupTrade",
    type: "function",
    inputs: [
      { name: "inputTokenForSale", type: "address" },
      { name: "inputTokenAmount", type: "uint256" },
      { name: "outputTokenAsk", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "settleTrade",
    type: "function",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawFee",
    type: "function",
    inputs: [],
    outputs: [],
  },
  {
    name: "accumulatedFees",
    type: "function",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  const ownerPrivateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!ownerPrivateKey) {
    throw new Error("PRIVATE_KEY not set in .env");
  }

  const ownerAccount = privateKeyToAccount(`0x${ownerPrivateKey}`);

  console.log("========== ACCOUNTS ==========");
  console.log("Owner address:", ownerAccount.address);
  console.log("Alice address:", ALICE_ADDRESS);
  console.log("Bob address:", BOB_ADDRESS);

  const publicClient = createPublicClient({
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  // Check owner balance
  const ownerBalance = await publicClient.getBalance({ address: ownerAccount.address });
  console.log("\nOwner ETH balance:", formatEther(ownerBalance), "ETH");

  // Step 1: Fund Alice and Bob with ETH for gas (owner sends ETH)
  console.log("\n========== STEP 1: Fund Alice and Bob with ETH ==========");

  const fundAmount = parseEther("0.005"); // 0.005 ETH each for gas

  console.log("Sending 0.005 ETH to Alice...");
  let hash = await ownerWalletClient.sendTransaction({
    to: ALICE_ADDRESS,
    value: fundAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fund Alice hash:", hash);

  console.log("Sending 0.005 ETH to Bob...");
  hash = await ownerWalletClient.sendTransaction({
    to: BOB_ADDRESS,
    value: fundAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fund Bob hash:", hash);

  // Step 2: Transfer tokens to Alice and Bob
  console.log("\n========== STEP 2: Transfer tokens to Alice and Bob ==========");

  const tokenAmount = parseEther("1000");

  // Transfer TokenA to Alice (she will sell TokenA)
  console.log("Transferring 1000 TokenA to Alice...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [ALICE_ADDRESS, tokenAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenA to Alice hash:", hash);

  // Transfer TokenB to Bob (he will use TokenB to buy TokenA)
  console.log("Transferring 1000 TokenB to Bob...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [BOB_ADDRESS, tokenAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenB to Bob hash:", hash);

  // Step 3: Alice sets up trade
  // Since we don't have Alice's private key, Owner will act as Alice
  // We'll use the Owner to demonstrate the flow
  console.log("\n========== STEP 3: Alice (Owner acting) sets up trade ==========");

  // First, Owner approves TokenTrade contract to spend TokenA
  const sellAmount = parseEther("100");
  const askAmount = parseEther("200");

  console.log("Owner approving TokenTrade contract for TokenA...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, sellAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Approve hash:", hash);

  // Get current block timestamp and set expiry
  const block = await publicClient.getBlock();
  const expiry = block.timestamp + 3600n; // 1 hour from now

  // Owner sets up trade (acting as Alice - selling TokenA for TokenB)
  console.log("Setting up trade: Selling 100 TokenA for 200 TokenB...");
  const aliceSetupTradeHash = await ownerWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "setupTrade",
    args: [TOKEN_A_ADDRESS, sellAmount, askAmount, expiry],
  });
  await publicClient.waitForTransactionReceipt({ hash: aliceSetupTradeHash });
  console.log("\n*** Alice sets up trade hash:", aliceSetupTradeHash, "***\n");

  // Step 4: Bob (Owner acting) settles trade
  console.log("\n========== STEP 4: Bob (Owner acting) settles trade ==========");

  // Owner needs TokenB to settle the trade (since owner is also acting as Bob)
  // Owner already has TokenB from deployment

  // Approve TokenTrade contract to spend TokenB
  console.log("Approving TokenTrade contract for TokenB...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, askAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Approve hash:", hash);

  // Settle trade (trade ID is 0)
  console.log("Settling trade ID 0...");
  const bobSettleTradeHash = await ownerWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "settleTrade",
    args: [0n],
  });
  await publicClient.waitForTransactionReceipt({ hash: bobSettleTradeHash });
  console.log("\n*** Bob settles trade hash:", bobSettleTradeHash, "***\n");

  // Step 5: Owner withdraws fees
  console.log("\n========== STEP 5: Owner withdraws fees ==========");

  // Check accumulated fees
  const feesBefore = await publicClient.readContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "accumulatedFees",
    args: [TOKEN_A_ADDRESS],
  });
  console.log("Accumulated fees (TokenA):", formatEther(feesBefore), "ALPHA");

  console.log("Owner withdrawing fees...");
  const ownerWithdrawFeeHash = await ownerWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "withdrawFee",
    args: [],
  });
  await publicClient.waitForTransactionReceipt({ hash: ownerWithdrawFeeHash });
  console.log("\n*** Owner withdraw fee hash:", ownerWithdrawFeeHash, "***\n");

  // Final Summary
  console.log("\n========================================");
  console.log("         FINAL SUMMARY");
  console.log("========================================");
  console.log("");
  console.log("CONTRACT ADDRESSES:");
  console.log("  TokenA (ALPHA):", TOKEN_A_ADDRESS);
  console.log("  TokenB (BETA):", TOKEN_B_ADDRESS);
  console.log("  TokenTrade:", TOKEN_TRADE_ADDRESS);
  console.log("");
  console.log("WALLET ADDRESSES:");
  console.log("  Owner:", ownerAccount.address);
  console.log("  Alice:", ALICE_ADDRESS);
  console.log("  Bob:", BOB_ADDRESS);
  console.log("");
  console.log("TRANSACTION HASHES:");
  console.log("  Alice sets up trade:", aliceSetupTradeHash);
  console.log("  Bob settles trade:", bobSettleTradeHash);
  console.log("  Owner withdraw fee:", ownerWithdrawFeeHash);
  console.log("");
  console.log("EXPLORER LINKS:");
  console.log("  TokenA:", `https://explorer.garfield-testnet.zircuit.com/address/${TOKEN_A_ADDRESS}`);
  console.log("  TokenB:", `https://explorer.garfield-testnet.zircuit.com/address/${TOKEN_B_ADDRESS}`);
  console.log("  TokenTrade:", `https://explorer.garfield-testnet.zircuit.com/address/${TOKEN_TRADE_ADDRESS}`);
  console.log("========================================");
}

main()
  .then(() => {
    console.log("\nFlow execution completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
