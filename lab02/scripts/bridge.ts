import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import "dotenv/config";

// Bridge contract address on Sepolia (deposits ETH to Zircuit Garfield)
const BRIDGE_ADDRESS = "0x87a7E2bCA9E35BA49282E832a28A6023904460D8";

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env");
  }

  const account = privateKeyToAccount(`0x${privateKey}`);
  console.log("Account address:", account.address);

  // Use a more reliable Sepolia RPC
  const sepoliaRpc = "https://ethereum-sepolia-rpc.publicnode.com";

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(sepoliaRpc),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(sepoliaRpc),
  });

  // Check balance on Sepolia
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Sepolia balance:", balance, "wei");
  console.log("Sepolia balance:", Number(balance) / 1e18, "ETH");

  // Amount to bridge (0.04 ETH - leave some for gas)
  const bridgeAmount = parseEther("0.04");
  console.log("\nBridging", Number(bridgeAmount) / 1e18, "ETH to Zircuit Garfield testnet...");

  // Send ETH to bridge contract
  const hash = await walletClient.sendTransaction({
    to: BRIDGE_ADDRESS,
    value: bridgeAmount,
  });

  console.log("Bridge transaction hash:", hash);
  console.log("\nWaiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction confirmed in block:", receipt.blockNumber);
  console.log("\nBridge deposit successful!");
  console.log("Your ETH will appear on Zircuit Garfield testnet shortly (usually within a few minutes).");
  console.log("\nCheck your balance on Zircuit Garfield testnet:");
  console.log(`https://explorer.garfield-testnet.zircuit.com/address/${account.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
