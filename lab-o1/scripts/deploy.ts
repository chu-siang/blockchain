/**
 * deploy.ts – Deploy tokens + two DEX instances (basic & bonus)
 *
 * Usage:  pnpm hardhat run scripts/deploy.ts --network zircuit
 */
import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

const ON_SITE_CHECKER = "0xa6FF20737004fb2f632B6b9388C7731B871a201D" as const;
const FEE_RECIPIENT   = "0x3AD64ABb43D793025a2f2bD9d615fa1447008bFD" as const;
const RATE            = BigInt(process.env.RATE ?? "2");

async function main() {
  const { viem } = await network.connect();
  const pc = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deployer:", deployer.account.address, "Rate:", RATE.toString());

  const tokenA   = await viem.deployContract("Token", ["Token A", "TKA"]);
  const tokenB   = await viem.deployContract("Token", ["Token B", "TKB"]);
  const dexBasic = await viem.deployContract("DEX", [tokenA.address, tokenB.address, RATE, zeroAddress]);
  const dexBonus = await viem.deployContract("DEX", [tokenA.address, tokenB.address, RATE, FEE_RECIPIENT]);

  console.log("TokenA:", tokenA.address);
  console.log("TokenB:", tokenB.address);
  console.log("DEX basic:", dexBasic.address);
  console.log("DEX bonus:", dexBonus.address);

  // Transfer tokens to OnSiteChecker (enough for both checks)
  const amountA = parseEther("10000") * RATE;
  const amountB = parseEther("10000");
  let tx = await tokenA.write.transfer([ON_SITE_CHECKER, amountA]);
  await pc.waitForTransactionReceipt({ hash: tx });
  tx = await tokenB.write.transfer([ON_SITE_CHECKER, amountB]);
  await pc.waitForTransactionReceipt({ hash: tx });

  console.log("\nUpdate .env:");
  console.log(`TOKEN_A_ADDRESS=${tokenA.address}`);
  console.log(`TOKEN_B_ADDRESS=${tokenB.address}`);
  console.log(`DEX_BASIC_ADDRESS=${dexBasic.address}`);
  console.log(`DEX_BONUS_ADDRESS=${dexBonus.address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
