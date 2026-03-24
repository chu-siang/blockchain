import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import "dotenv/config";

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY || "";
const BOB_PRIVATE_KEY = process.env.BOB_PRIVATE_KEY || "";

const accounts = [DEPLOYER_PRIVATE_KEY, ALICE_PRIVATE_KEY, BOB_PRIVATE_KEY].filter(Boolean) as `0x${string}`[];

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    zircuit: {
      type: "http",
      chainType: "l1",
      url: "https://garfield-testnet.zircuit.com",
      accounts: accounts,
    },
  },
});
