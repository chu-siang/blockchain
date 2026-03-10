import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Contract addresses from deployment
const TOKEN_A_ADDRESS = "0x155a5a762b7163e4270db8899b82bb81b7fa3bdb" as `0x${string}`;
const TOKEN_B_ADDRESS = "0x79ba1ef4481627da7860dafd57fd790230a16e0a" as `0x${string}`;
const TOKEN_TRADE_ADDRESS = "0x1f993aab8b432a9c792c9a953cc16c5b7d95a951" as `0x${string}`;

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
  // Load private keys
  const ownerPrivateKey = process.env.PRIVATE_KEY;
  const alicePrivateKey = process.env.ALICE_PRIVATE_KEY;
  const bobPrivateKey = process.env.BOB_PRIVATE_KEY;

  if (!ownerPrivateKey || !alicePrivateKey || !bobPrivateKey) {
    throw new Error("Missing private keys in .env");
  }

  const ownerAccount = privateKeyToAccount(`0x${ownerPrivateKey}`);
  const aliceAccount = privateKeyToAccount(`0x${alicePrivateKey}`);
  const bobAccount = privateKeyToAccount(`0x${bobPrivateKey}`);

  console.log("========== ACCOUNTS ==========");
  console.log("Owner address:", ownerAccount.address);
  console.log("Alice address:", aliceAccount.address);
  console.log("Bob address:", bobAccount.address);

  const publicClient = createPublicClient({
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  const aliceWalletClient = createWalletClient({
    account: aliceAccount,
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  const bobWalletClient = createWalletClient({
    account: bobAccount,
    chain: zircuitGarfield,
    transport: http("https://garfield-testnet.zircuit.com"),
  });

  // Check balances
  const ownerBalance = await publicClient.getBalance({ address: ownerAccount.address });
  console.log("\nOwner ETH balance:", formatEther(ownerBalance), "ETH");

  // Step 1: Fund Alice and Bob with ETH for gas
  console.log("\n========== STEP 1: Fund Alice and Bob with ETH ==========");

  const fundAmount = parseEther("0.005");

  console.log("Sending 0.005 ETH to Alice...");
  let hash = await ownerWalletClient.sendTransaction({
    to: aliceAccount.address,
    value: fundAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fund Alice tx:", hash);

  console.log("Sending 0.005 ETH to Bob...");
  hash = await ownerWalletClient.sendTransaction({
    to: bobAccount.address,
    value: fundAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fund Bob tx:", hash);

  // Step 2: Transfer tokens to Alice and Bob
  console.log("\n========== STEP 2: Transfer tokens to Alice and Bob ==========");

  const tokenAmount = parseEther("1000");

  console.log("Transferring 1000 TokenA to Alice...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [aliceAccount.address, tokenAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenA to Alice tx:", hash);

  console.log("Transferring 1000 TokenB to Bob...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [bobAccount.address, tokenAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenB to Bob tx:", hash);

  // Step 3: Alice sets up trade
  console.log("\n========== STEP 3: Alice sets up trade ==========");

  const sellAmount = parseEther("100");  // Alice sells 100 TokenA
  const askAmount = parseEther("200");   // Alice wants 200 TokenB

  console.log("Alice approving TokenTrade contract...");
  hash = await aliceWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, sellAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Alice approve tx:", hash);

  // Get current block timestamp and set expiry
  const block = await publicClient.getBlock();
  const expiry = block.timestamp + 3600n; // 1 hour from now

  console.log("Alice setting up trade: Selling 100 TokenA for 200 TokenB...");
  const aliceSetupTradeHash = await aliceWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "setupTrade",
    args: [TOKEN_A_ADDRESS, sellAmount, askAmount, expiry],
  });
  await publicClient.waitForTransactionReceipt({ hash: aliceSetupTradeHash });
  console.log("\n*** ALICE SETS UP TRADE HASH:", aliceSetupTradeHash, "***\n");

  // Step 4: Bob settles trade
  console.log("\n========== STEP 4: Bob settles trade ==========");

  console.log("Bob approving TokenTrade contract...");
  hash = await bobWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, askAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Bob approve tx:", hash);

  console.log("Bob settling trade ID 0...");
  const bobSettleTradeHash = await bobWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: TOKEN_TRADE_ABI,
    functionName: "settleTrade",
    args: [0n],
  });
  await publicClient.waitForTransactionReceipt({ hash: bobSettleTradeHash });
  console.log("\n*** BOB SETTLES TRADE HASH:", bobSettleTradeHash, "***\n");

  // Step 5: Owner withdraws fees
  console.log("\n========== STEP 5: Owner withdraws fees ==========");

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
  console.log("\n*** OWNER WITHDRAW FEE HASH:", ownerWithdrawFeeHash, "***\n");

  // Final Summary
  console.log("\n================================================================");
  console.log("                     FINAL SUMMARY");
  console.log("================================================================");
  console.log("");
  console.log("CONTRACT ADDRESSES:");
  console.log("  TokenA (ALPHA):    ", TOKEN_A_ADDRESS);
  console.log("  TokenB (BETA):     ", TOKEN_B_ADDRESS);
  console.log("  TokenTrade:        ", TOKEN_TRADE_ADDRESS);
  console.log("");
  console.log("WALLET ADDRESSES:");
  console.log("  Owner:             ", ownerAccount.address);
  console.log("  Alice:             ", aliceAccount.address);
  console.log("  Bob:               ", bobAccount.address);
  console.log("");
  console.log("TRANSACTION HASHES:");
  console.log("  Alice sets up trade:", aliceSetupTradeHash);
  console.log("  Bob settles trade:  ", bobSettleTradeHash);
  console.log("  Owner withdraw fee: ", ownerWithdrawFeeHash);
  console.log("");
  console.log("EXPLORER LINKS:");
  console.log("  TokenA:     https://explorer.garfield-testnet.zircuit.com/address/" + TOKEN_A_ADDRESS);
  console.log("  TokenB:     https://explorer.garfield-testnet.zircuit.com/address/" + TOKEN_B_ADDRESS);
  console.log("  TokenTrade: https://explorer.garfield-testnet.zircuit.com/address/" + TOKEN_TRADE_ADDRESS);
  console.log("================================================================");
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
