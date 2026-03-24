import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying PermitToken with account:", deployer.account.address);

  const token = await viem.deployContract("PermitToken");
  console.log("PermitToken deployed to:", token.address);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("PermitToken address:", token.address);
  console.log("Deployer address:   ", deployer.account.address);
  console.log("=========================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
