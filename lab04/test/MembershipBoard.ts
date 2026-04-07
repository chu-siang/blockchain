import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { encodeFunctionData } from "viem";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const membersData = JSON.parse(readFileSync(join(__dirname, "..", "members.json"), "utf-8"));
const allAddresses: `0x${string}`[] = membersData.addresses;

// Build Merkle tree from all 1000 addresses
const leaves = allAddresses.map((addr) => [addr] as [string]);
const tree = StandardMerkleTree.of(leaves, ["address"]);

describe("MembershipBoard", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, nonOwner] = await viem.getWalletClients();

  // ==================== Part 1: addMember ====================
  describe("addMember (Part 1)", function () {
    it("Owner can add a single member", async function () {
      const board = await viem.deployContract("MembershipBoard");
      const hash = await board.write.addMember([allAddresses[0]]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[0]]), true);
    });

    it("Non-owner cannot add a member", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await assert.rejects(async () => {
        await board.write.addMember([allAddresses[0]], { account: nonOwner.account });
      });
    });

    it("Adding a duplicate member reverts", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.addMember([allAddresses[0]]);
      await assert.rejects(async () => {
        await board.write.addMember([allAddresses[0]]);
      });
    });
  });

  // ==================== Part 2: batchAddMembers ====================
  describe("batchAddMembers (Part 2)", function () {
    it("Owner can batch add members", async function () {
      const board = await viem.deployContract("MembershipBoard");
      const batch = allAddresses.slice(0, 10);
      const hash = await board.write.batchAddMembers([batch]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
      for (const addr of batch) {
        assert.equal(await board.read.verifyMemberByMapping([addr]), true);
      }
    });

    it("Adding a duplicate in a batch reverts", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.addMember([allAddresses[0]]);
      await assert.rejects(async () => {
        await board.write.batchAddMembers([allAddresses.slice(0, 5)]);
      });
    });

    it("All 1,000 members are correctly stored after batch add", async function () {
      const board = await viem.deployContract("MembershipBoard");
      const batchSize = 250;
      for (let i = 0; i < allAddresses.length; i += batchSize) {
        const batch = allAddresses.slice(i, i + batchSize);
        await board.write.batchAddMembers([batch]);
      }
      // Spot check several members
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[0]]), true);
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[499]]), true);
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[999]]), true);
    });
  });

  // ==================== Part 3: setMerkleRoot ====================
  describe("setMerkleRoot (Part 3)", function () {
    it("Owner can set the Merkle root", async function () {
      const board = await viem.deployContract("MembershipBoard");
      const hash = await board.write.setMerkleRoot([tree.root as `0x${string}`]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
      assert.equal(await board.read.merkleRoot(), tree.root);
    });

    it("Non-owner cannot set the Merkle root", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await assert.rejects(async () => {
        await board.write.setMerkleRoot([tree.root as `0x${string}`], { account: nonOwner.account });
      });
    });
  });

  // ==================== Part 4: verifyMemberByMapping ====================
  describe("verifyMemberByMapping (Part 4)", function () {
    it("Returns true for a registered member", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.addMember([allAddresses[0]]);
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[0]]), true);
    });

    it("Returns false for a non-member", async function () {
      const board = await viem.deployContract("MembershipBoard");
      assert.equal(await board.read.verifyMemberByMapping([allAddresses[0]]), false);
    });
  });

  // ==================== Part 5: verifyMemberByProof ====================
  describe("verifyMemberByProof (Part 5)", function () {
    it("Valid proof for a registered member returns true", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.setMerkleRoot([tree.root as `0x${string}`]);
      const proof = tree.getProof([allAddresses[0]]) as `0x${string}`[];
      assert.equal(await board.read.verifyMemberByProof([allAddresses[0], proof]), true);
    });

    it("Invalid proof returns false", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.setMerkleRoot([tree.root as `0x${string}`]);
      // Use proof for address[0] but check address[1]
      const proof = tree.getProof([allAddresses[0]]) as `0x${string}`[];
      assert.equal(await board.read.verifyMemberByProof([allAddresses[1], proof]), false);
    });

    it("Proof for a non-member returns false", async function () {
      const board = await viem.deployContract("MembershipBoard");
      await board.write.setMerkleRoot([tree.root as `0x${string}`]);
      const fakeAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`;
      const fakeProof = tree.getProof([allAddresses[0]]) as `0x${string}`[];
      assert.equal(await board.read.verifyMemberByProof([fakeAddress, fakeProof]), false);
    });
  });

  // ==================== Gas Profiling ====================
  describe("Gas Profiling", function () {
    it("Measure gas for all 5 actions", async function () {
      // --- 1. addMember (single call) ---
      const board1 = await viem.deployContract("MembershipBoard");
      const hash1 = await board1.write.addMember([allAddresses[0]]);
      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      const addMemberGas = receipt1.gasUsed;

      // --- 2. batchAddMembers (all 1000, batch=250) ---
      const board2 = await viem.deployContract("MembershipBoard");
      let totalBatchGas = 0n;
      const batchSize = 250;
      for (let i = 0; i < allAddresses.length; i += batchSize) {
        const batch = allAddresses.slice(i, i + batchSize);
        const hash = await board2.write.batchAddMembers([batch]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        totalBatchGas += receipt.gasUsed;
      }

      // --- 3. setMerkleRoot ---
      const board3 = await viem.deployContract("MembershipBoard");
      const hash3 = await board3.write.setMerkleRoot([tree.root as `0x${string}`]);
      const receipt3 = await publicClient.waitForTransactionReceipt({ hash: hash3 });
      const setMerkleRootGas = receipt3.gasUsed;

      // --- 4. verifyMemberByMapping ---
      const mappingGas = await publicClient.estimateGas({
        account: owner.account.address,
        to: board2.address,
        data: encodeFunctionData({
          abi: board2.abi,
          functionName: "verifyMemberByMapping",
          args: [allAddresses[0]],
        }),
      });

      // --- 5. verifyMemberByProof ---
      const proof = tree.getProof([allAddresses[0]]) as `0x${string}`[];
      const proofGas = await publicClient.estimateGas({
        account: owner.account.address,
        to: board3.address,
        data: encodeFunctionData({
          abi: board3.abi,
          functionName: "verifyMemberByProof",
          args: [allAddresses[0], proof],
        }),
      });

      // Print results
      const addMemberTotal = addMemberGas * 1000n;
      console.log("\n========== Gas Profiling Results ==========");
      console.log(`| Action | Gas Used |`);
      console.log(`|--------|----------|`);
      console.log(`| addMember (single call) | ${addMemberGas} |`);
      console.log(`| addMember x1000 (total estimated) | ${addMemberTotal} |`);
      console.log(`| batchAddMembers (all 1000, batch=250) | ${totalBatchGas} |`);
      console.log(`| setMerkleRoot | ${setMerkleRootGas} |`);
      console.log(`| verifyMemberByMapping | ${mappingGas} |`);
      console.log(`| verifyMemberByProof | ${proofGas} |`);
      console.log("============================================\n");
    });

    it("Batch size experimentation (50, 100, 250, 500)", async function () {
      const batchSizes = [50, 100, 250, 500];
      console.log("\n========== Batch Size Experimentation ==========");
      console.log("| Batch Size | Total Gas | Per-Member Gas | Batches |");
      console.log("|------------|-----------|----------------|---------|");

      for (const batchSize of batchSizes) {
        const board = await viem.deployContract("MembershipBoard");
        let totalGas = 0n;
        let numBatches = 0;
        for (let i = 0; i < allAddresses.length; i += batchSize) {
          const batch = allAddresses.slice(i, i + batchSize);
          const hash = await board.write.batchAddMembers([batch]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          totalGas += receipt.gasUsed;
          numBatches++;
        }
        const perMember = totalGas / 1000n;
        console.log(`| ${batchSize} | ${totalGas} | ${perMember} | ${numBatches} |`);
      }
      console.log("=================================================\n");
    });
  });
});
