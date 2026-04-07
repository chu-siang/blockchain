/**
 * check.ts – Call OnSiteChecker.check() or checkBonus()
 *
 * Usage:
 *   pnpm hardhat run scripts/check.ts --network zircuit          # basic
 *   BONUS=1 pnpm hardhat run scripts/check.ts --network zircuit  # bonus
 */
import { network } from "hardhat";

const ON_SITE_CHECKER = "0xa6FF20737004fb2f632B6b9388C7731B871a201D" as `0x${string}`;
const TOKEN_A    = process.env.TOKEN_A_ADDRESS as `0x${string}`;
const TOKEN_B    = process.env.TOKEN_B_ADDRESS as `0x${string}`;
const RATE       = BigInt(process.env.RATE ?? "2");
const STUDENT_ID = process.env.STUDENT_ID ?? "";

const isBonus    = !!process.env.BONUS;
const DEX        = (isBonus ? process.env.DEX_BONUS_ADDRESS : process.env.DEX_BASIC_ADDRESS) as `0x${string}`;
const fnName     = isBonus ? "checkBonus" : "check";

if (!DEX || !TOKEN_A || !TOKEN_B || !STUDENT_ID) {
  throw new Error("Set TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, DEX_BASIC_ADDRESS (or DEX_BONUS_ADDRESS), STUDENT_ID in .env");
}

const ABI = [{
  name: fnName, type: "function" as const, stateMutability: "nonpayable" as const,
  inputs: [
    { name: "studentId", type: "string" },
    { name: "dex",       type: "address" },
    { name: "tokenA",    type: "address" },
    { name: "tokenB",    type: "address" },
    { name: "rate",      type: "uint256" },
  ],
  outputs: [],
}];

async function main() {
  const { viem } = await network.connect();
  const pc = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log(`Calling ${fnName}() — student=${STUDENT_ID} dex=${DEX} rate=${RATE}`);

  const hash = await deployer.writeContract({
    address: ON_SITE_CHECKER, abi: ABI, functionName: fnName,
    args: [STUDENT_ID, DEX, TOKEN_A, TOKEN_B, RATE],
  });

  const receipt = await pc.waitForTransactionReceipt({ hash });
  console.log(`${receipt.status === "success" ? "SUCCESS" : "FAILED"} — ${fnName} tx: ${hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
