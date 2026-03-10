import { network } from "hardhat";
import { parseEther } from "viem";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying contracts with account:", deployer.account.address);

  // Deploy TokenA
  console.log("\nDeploying TokenA...");
  const tokenA = await viem.deployContract("TokenA");
  console.log("TokenA deployed to:", tokenA.address);

  // Deploy TokenB
  console.log("\nDeploying TokenB...");
  const tokenB = await viem.deployContract("TokenB");
  console.log("TokenB deployed to:", tokenB.address);

  // Deploy TokenTrade
  console.log("\nDeploying TokenTrade...");
  const tokenTrade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);
  console.log("TokenTrade deployed to:", tokenTrade.address);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("TokenA address:", tokenA.address);
  console.log("TokenB address:", tokenB.address);
  console.log("TokenTrade address:", tokenTrade.address);
  console.log("Owner address:", deployer.account.address);
  console.log("=========================================");

  return {
    tokenA: tokenA.address,
    tokenB: tokenB.address,
    tokenTrade: tokenTrade.address,
    owner: deployer.account.address
  };
}

main()
  .then((result) => {
    console.log("\nDeployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
