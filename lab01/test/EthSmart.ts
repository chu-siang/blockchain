import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

describe("EthSmart", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, user1, user2] = await viem.getWalletClients();

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const contractOwner = await vault.read.owner();
      assert.equal(contractOwner.toLowerCase(), owner.account.address.toLowerCase());
    });

    it("Should start with zero balance", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const balance = await vault.read.getBalance();
      assert.equal(balance, 0n);
    });
  });

  describe("Test Group A - Deposits", function () {
    it("Should accept ETH and increase balance (single deposit)", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Send ETH to the contract
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      const balance = await vault.read.getBalance();
      assert.equal(balance, parseEther("1"));
    });

    it("Should emit Deposit event with correct values (single deposit)", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      // Send ETH to the contract
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("2"),
      });

      // Check for Deposit event
      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "Deposit",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.sender?.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(events[0].args.amount, parseEther("2"));
    });

    it("Should handle multiple deposits correctly", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      // Send multiple deposits
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      await user2.sendTransaction({
        to: vault.address,
        value: parseEther("2"),
      });

      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("0.5"),
      });

      const balance = await vault.read.getBalance();
      assert.equal(balance, parseEther("3.5"));

      // Verify all events were emitted
      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "Deposit",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 3);
    });

    it("Should accept deposits from different senders", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      await user2.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "Deposit",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 2);
      assert.equal(events[0].args.sender?.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(events[1].args.sender?.toLowerCase(), user2.account.address.toLowerCase());
    });

    it("Should emit event even for repeated senders", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      // Same sender deposits twice
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("2"),
      });

      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "Deposit",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 2);
      assert.equal(events[0].args.sender?.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(events[1].args.sender?.toLowerCase(), user1.account.address.toLowerCase());
    });
  });

  describe("Test Group B - Owner Withdrawal", function () {
    it("Should allow owner to withdraw partial amount", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("10"),
      });

      const initialBalance = await vault.read.getBalance();
      assert.equal(initialBalance, parseEther("10"));

      // Owner withdraws partial amount
      await vault.write.withdraw([parseEther("3")]);

      const finalBalance = await vault.read.getBalance();
      assert.equal(finalBalance, parseEther("7"));
    });

    it("Should allow owner to withdraw full balance", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      // Owner withdraws all
      await vault.write.withdraw([parseEther("5")]);

      const finalBalance = await vault.read.getBalance();
      assert.equal(finalBalance, 0n);
    });

    it("Should emit Weethdraw event correctly", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      const deploymentBlockNumber = await publicClient.getBlockNumber();

      // Owner withdraws
      await vault.write.withdraw([parseEther("2")]);

      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "Weethdraw",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.to?.toLowerCase(), owner.account.address.toLowerCase());
      assert.equal(events[0].args.amount, parseEther("2"));
    });

    it("Should decrease balance correctly after withdrawal", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("10"),
      });

      const balanceBefore = await vault.read.getBalance();

      // Withdraw
      await vault.write.withdraw([parseEther("4")]);

      const balanceAfter = await vault.read.getBalance();
      assert.equal(balanceAfter, balanceBefore - parseEther("4"));
    });
  });

  describe("Test Group C - Unauthorized Withdrawal", function () {
    it("Should prevent non-owner from withdrawing funds", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      const balanceBefore = await vault.read.getBalance();

      // Non-owner attempts to withdraw
      await vault.write.withdraw([parseEther("2")], { account: user1.account });

      const balanceAfter = await vault.read.getBalance();
      // Balance should remain unchanged
      assert.equal(balanceAfter, balanceBefore);
    });

    it("Should emit UnauthorizedWithdrawAttempt event", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      const deploymentBlockNumber = await publicClient.getBlockNumber();

      // Non-owner attempts to withdraw
      await vault.write.withdraw([parseEther("2")], { account: user1.account });

      const events = await publicClient.getContractEvents({
        address: vault.address,
        abi: vault.abi,
        eventName: "UnauthorizedWithdrawAttempt",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.caller?.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(events[0].args.amount, parseEther("2"));
    });

    it("Should not revert on unauthorized withdrawal attempt", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      // This should not throw an error
      await vault.write.withdraw([parseEther("2")], { account: user1.account });

      // Verify balance is unchanged
      const balance = await vault.read.getBalance();
      assert.equal(balance, parseEther("5"));
    });

    it("Should keep contract balance unchanged after unauthorized attempt", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("10"),
      });

      const balanceBefore = await vault.read.getBalance();

      // Multiple unauthorized attempts
      await vault.write.withdraw([parseEther("3")], { account: user1.account });
      await vault.write.withdraw([parseEther("5")], { account: user2.account });

      const balanceAfter = await vault.read.getBalance();
      assert.equal(balanceAfter, balanceBefore);
    });
  });

  describe("Test Group D - Edge Cases", function () {
    it("Should revert when withdrawing more than balance", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      // Try to withdraw more than balance
      await assert.rejects(
        async () => {
          await vault.write.withdraw([parseEther("10")]);
        },
        {
          message: /Insufficient balance/,
        }
      );
    });

    it("Should handle withdraw of zero amount", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("5"),
      });

      const balanceBefore = await vault.read.getBalance();

      // Withdraw zero
      await vault.write.withdraw([0n]);

      const balanceAfter = await vault.read.getBalance();
      assert.equal(balanceAfter, balanceBefore);
    });

    it("Should handle multiple deposits before withdrawal", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Multiple deposits
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("2"),
      });

      await user2.sendTransaction({
        to: vault.address,
        value: parseEther("3"),
      });

      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("1"),
      });

      const balanceBeforeWithdraw = await vault.read.getBalance();
      assert.equal(balanceBeforeWithdraw, parseEther("6"));

      // Owner withdraws
      await vault.write.withdraw([parseEther("4")]);

      const balanceAfterWithdraw = await vault.read.getBalance();
      assert.equal(balanceAfterWithdraw, parseEther("2"));
    });

    it("Should handle withdrawal from empty contract", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Try to withdraw from empty contract
      await assert.rejects(
        async () => {
          await vault.write.withdraw([parseEther("1")]);
        },
        {
          message: /Insufficient balance/,
        }
      );
    });

    it("Should handle multiple withdrawals in sequence", async function () {
      const vault = await viem.deployContract("EthSmart", [owner.account.address]);

      // Deposit ETH
      await user1.sendTransaction({
        to: vault.address,
        value: parseEther("10"),
      });

      // Multiple withdrawals
      await vault.write.withdraw([parseEther("2")]);
      await vault.write.withdraw([parseEther("3")]);
      await vault.write.withdraw([parseEther("1")]);

      const finalBalance = await vault.read.getBalance();
      assert.equal(finalBalance, parseEther("4"));
    });
  });
});
