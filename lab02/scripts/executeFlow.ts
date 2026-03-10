import { network } from "hardhat";
import { parseEther, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zircuitTestnet } from "viem/chains";

// Contract addresses (fill in after deployment)
const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS as `0x${string}`;
const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS as `0x${string}`;
const TOKEN_TRADE_ADDRESS = process.env.TOKEN_TRADE_ADDRESS as `0x${string}`;

// Private keys
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY as `0x${string}`;
const BOB_PRIVATE_KEY = process.env.BOB_PRIVATE_KEY as `0x${string}`;

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Create wallet clients for each user
  const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
  const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);
  const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY);

  console.log("Owner address:", ownerAccount.address);
  console.log("Alice address:", aliceAccount.address);
  console.log("Bob address:", bobAccount.address);

  // Get contract instances
  const tokenA = await viem.getContractAt("TokenA", TOKEN_A_ADDRESS);
  const tokenB = await viem.getContractAt("TokenB", TOKEN_B_ADDRESS);
  const tokenTrade = await viem.getContractAt("TokenTrade", TOKEN_TRADE_ADDRESS);

  // Contract instances for different users
  const tokenAAsOwner = await viem.getContractAt("TokenA", TOKEN_A_ADDRESS);
  const tokenBAsOwner = await viem.getContractAt("TokenB", TOKEN_B_ADDRESS);

  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain: zircuitTestnet,
    transport: http("https://zircuit1-testnet.p2pify.com"),
  });

  const aliceWalletClient = createWalletClient({
    account: aliceAccount,
    chain: zircuitTestnet,
    transport: http("https://zircuit1-testnet.p2pify.com"),
  });

  const bobWalletClient = createWalletClient({
    account: bobAccount,
    chain: zircuitTestnet,
    transport: http("https://zircuit1-testnet.p2pify.com"),
  });

  // Step 1: Owner transfers tokens to Alice and Bob
  console.log("\n========== STEP 1: Transfer tokens to Alice and Bob ==========");

  const transferAmount = parseEther("1000");

  // Transfer TokenA to Alice (she will sell TokenA)
  console.log("Transferring 1000 TokenA to Alice...");
  let hash = await ownerWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: tokenA.abi,
    functionName: "transfer",
    args: [aliceAccount.address, transferAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenA to Alice hash:", hash);

  // Transfer TokenB to Bob (he will buy TokenA with TokenB)
  console.log("Transferring 1000 TokenB to Bob...");
  hash = await ownerWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: tokenB.abi,
    functionName: "transfer",
    args: [bobAccount.address, transferAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transfer TokenB to Bob hash:", hash);

  // Step 2: Alice sets up trade
  console.log("\n========== STEP 2: Alice sets up trade ==========");

  const sellAmount = parseEther("100"); // Alice sells 100 TokenA
  const askAmount = parseEther("200");  // Alice asks for 200 TokenB

  // Alice approves TokenTrade contract
  console.log("Alice approving TokenTrade contract...");
  hash = await aliceWalletClient.writeContract({
    address: TOKEN_A_ADDRESS,
    abi: tokenA.abi,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, sellAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Alice approve hash:", hash);

  // Get current block timestamp and set expiry to 1 hour from now
  const block = await publicClient.getBlock();
  const expiry = block.timestamp + 3600n;

  // Alice sets up trade
  console.log("Alice setting up trade...");
  const aliceSetupTradeHash = await aliceWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: tokenTrade.abi,
    functionName: "setupTrade",
    args: [TOKEN_A_ADDRESS, sellAmount, askAmount, expiry],
  });
  await publicClient.waitForTransactionReceipt({ hash: aliceSetupTradeHash });
  console.log("\n*** Alice sets up trade hash:", aliceSetupTradeHash, "***\n");

  // Step 3: Bob settles trade
  console.log("\n========== STEP 3: Bob settles trade ==========");

  // Bob approves TokenTrade contract
  console.log("Bob approving TokenTrade contract...");
  hash = await bobWalletClient.writeContract({
    address: TOKEN_B_ADDRESS,
    abi: tokenB.abi,
    functionName: "approve",
    args: [TOKEN_TRADE_ADDRESS, askAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Bob approve hash:", hash);

  // Bob settles trade (trade ID is 0)
  console.log("Bob settling trade...");
  const bobSettleTradeHash = await bobWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: tokenTrade.abi,
    functionName: "settleTrade",
    args: [0n],
  });
  await publicClient.waitForTransactionReceipt({ hash: bobSettleTradeHash });
  console.log("\n*** Bob settles trade hash:", bobSettleTradeHash, "***\n");

  // Step 4: Owner withdraws fees
  console.log("\n========== STEP 4: Owner withdraws fees ==========");

  console.log("Owner withdrawing fees...");
  const ownerWithdrawFeeHash = await ownerWalletClient.writeContract({
    address: TOKEN_TRADE_ADDRESS,
    abi: tokenTrade.abi,
    functionName: "withdrawFee",
    args: [],
  });
  await publicClient.waitForTransactionReceipt({ hash: ownerWithdrawFeeHash });
  console.log("\n*** Owner withdraw fee hash:", ownerWithdrawFeeHash, "***\n");

  // Summary
  console.log("\n========== FINAL SUMMARY ==========");
  console.log("TokenA address:", TOKEN_A_ADDRESS);
  console.log("TokenB address:", TOKEN_B_ADDRESS);
  console.log("TokenTrade address:", TOKEN_TRADE_ADDRESS);
  console.log("");
  console.log("Owner address:", ownerAccount.address);
  console.log("Alice address:", aliceAccount.address);
  console.log("Bob address:", bobAccount.address);
  console.log("");
  console.log("Alice sets up trade hash:", aliceSetupTradeHash);
  console.log("Bob settles trade hash:", bobSettleTradeHash);
  console.log("Owner withdraw fee hash:", ownerWithdrawFeeHash);
  console.log("====================================");
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
