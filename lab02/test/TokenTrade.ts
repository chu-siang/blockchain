import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("TokenTrade", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, alice, bob] = await viem.getWalletClients();

  describe("ERC20 Tokens", function () {
    it("TokenA should have correct name, symbol, and total supply", async function () {
      const tokenA = await viem.deployContract("TokenA");

      assert.equal(await tokenA.read.name(), "Alpha Token");
      assert.equal(await tokenA.read.symbol(), "ALPHA");
      assert.equal(await tokenA.read.decimals(), 18);
      assert.equal(await tokenA.read.totalSupply(), parseEther("100000000"));
    });

    it("TokenB should have correct name, symbol, and total supply", async function () {
      const tokenB = await viem.deployContract("TokenB");

      assert.equal(await tokenB.read.name(), "Beta Token");
      assert.equal(await tokenB.read.symbol(), "BETA");
      assert.equal(await tokenB.read.decimals(), 18);
      assert.equal(await tokenB.read.totalSupply(), parseEther("100000000"));
    });

    it("Deployer should receive all tokens on deployment", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");

      assert.equal(
        await tokenA.read.balanceOf([owner.account.address]),
        parseEther("100000000")
      );
      assert.equal(
        await tokenB.read.balanceOf([owner.account.address]),
        parseEther("100000000")
      );
    });
  });

  describe("TokenTrade Contract", function () {
    it("Should initialize with correct tokens", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      assert.equal(getAddress(await trade.read.tokenA()), getAddress(tokenA.address));
      assert.equal(getAddress(await trade.read.tokenB()), getAddress(tokenB.address));
    });

    it("Should fail if tokens are the same", async function () {
      const tokenA = await viem.deployContract("TokenA");

      await assert.rejects(
        viem.deployContract("TokenTrade", [tokenA.address, tokenA.address]),
        /Tokens must be different/
      );
    });

    it("Should fail if token address is zero", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const zeroAddress = "0x0000000000000000000000000000000000000000";

      await assert.rejects(
        viem.deployContract("TokenTrade", [tokenA.address, zeroAddress]),
        /Invalid token address/
      );
    });
  });

  describe("setupTrade", function () {
    it("Should allow user to setup a trade and emit TradeCreated event", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      // Transfer tokens to Alice
      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);

      // Alice approves trade contract
      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      // Get current block timestamp for expiry
      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n; // 1 hour from now

      // Alice sets up trade
      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });

      const hash = await tradeAsAlice.write.setupTrade([
        tokenA.address,
        parseEther("100"),
        parseEther("200"),
        expiry
      ]);

      // Check event was emitted
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: trade.address,
        abi: trade.abi,
        eventName: "TradeCreated",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.tradeId, 0n);
      assert.equal(getAddress(events[0].args.seller!), getAddress(alice.account.address));
      assert.equal(events[0].args.inputAmount, parseEther("100"));
      assert.equal(events[0].args.outputAmount, parseEther("200"));
    });

    it("Should fail if token is not one of the allowed tokens", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const tokenC = await viem.deployContract("TokenA"); // Another token
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      await assert.rejects(
        trade.write.setupTrade([tokenC.address, parseEther("100"), parseEther("200"), expiry]),
        /InvalidToken/
      );
    });

    it("Should fail if amounts are zero", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      await assert.rejects(
        trade.write.setupTrade([tokenA.address, 0n, parseEther("200"), expiry]),
        /InvalidAmount/
      );

      await assert.rejects(
        trade.write.setupTrade([tokenA.address, parseEther("100"), 0n, expiry]),
        /InvalidAmount/
      );
    });

    it("Should fail if expiry is in the past", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp - 1n; // In the past

      await assert.rejects(
        trade.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]),
        /InvalidExpiry/
      );
    });
  });

  describe("settleTrade", function () {
    it("Should allow user to settle a trade and emit TradeSettled event", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      // Transfer tokens
      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);
      await tokenB.write.transfer([bob.account.address, parseEther("1000")]);

      // Alice approves and sets up trade
      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      // Bob approves and settles trade
      const tokenBBob = await viem.getContractAt("TokenB", tokenB.address, { client: { wallet: bob } });
      await tokenBBob.write.approve([trade.address, parseEther("200")]);

      const tradeAsBob = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: bob } });
      const hash = await tradeAsBob.write.settleTrade([0n]);

      // Check event
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: trade.address,
        abi: trade.abi,
        eventName: "TradeSettled",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.tradeId, 0n);
      assert.equal(getAddress(events[0].args.seller!), getAddress(alice.account.address));
      assert.equal(getAddress(events[0].args.buyer!), getAddress(bob.account.address));

      // Fee should be 0.1% of 100 = 0.1 tokens
      assert.equal(events[0].args.fee, parseEther("0.1"));
    });

    it("Should charge 0.1% fee on trades", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      // Transfer tokens
      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);
      await tokenB.write.transfer([bob.account.address, parseEther("1000")]);

      // Alice sets up trade: selling 100 TokenA for 200 TokenB
      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      const aliceTokenABefore = await tokenA.read.balanceOf([alice.account.address]);
      const aliceTokenBBefore = await tokenB.read.balanceOf([alice.account.address]);
      const bobTokenABefore = await tokenA.read.balanceOf([bob.account.address]);
      const bobTokenBBefore = await tokenB.read.balanceOf([bob.account.address]);

      // Bob settles trade
      const tokenBBob = await viem.getContractAt("TokenB", tokenB.address, { client: { wallet: bob } });
      await tokenBBob.write.approve([trade.address, parseEther("200")]);

      const tradeAsBob = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: bob } });
      await tradeAsBob.write.settleTrade([0n]);

      const aliceTokenAAfter = await tokenA.read.balanceOf([alice.account.address]);
      const aliceTokenBAfter = await tokenB.read.balanceOf([alice.account.address]);
      const bobTokenAAfter = await tokenA.read.balanceOf([bob.account.address]);
      const bobTokenBAfter = await tokenB.read.balanceOf([bob.account.address]);

      // Alice should have same TokenA (already transferred during setup) and +200 TokenB
      assert.equal(aliceTokenAAfter, aliceTokenABefore);
      assert.equal(aliceTokenBAfter - aliceTokenBBefore, parseEther("200"));

      // Bob should have +99.9 TokenA (100 - 0.1 fee) and -200 TokenB
      assert.equal(bobTokenAAfter - bobTokenABefore, parseEther("99.9"));
      assert.equal(bobTokenBBefore - bobTokenBAfter, parseEther("200"));

      // Contract should have 0.1 TokenA as accumulated fee
      assert.equal(await trade.read.accumulatedFees([tokenA.address]), parseEther("0.1"));
    });

    it("Should fail if trade does not exist", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      await assert.rejects(
        trade.write.settleTrade([999n]),
        /TradeNotFound/
      );
    });

    it("Should fail if trade is already settled", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      // Setup and settle trade
      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);
      await tokenB.write.transfer([bob.account.address, parseEther("1000")]);

      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      const tokenBBob = await viem.getContractAt("TokenB", tokenB.address, { client: { wallet: bob } });
      await tokenBBob.write.approve([trade.address, parseEther("200")]);

      const tradeAsBob = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: bob } });
      await tradeAsBob.write.settleTrade([0n]);

      // Try to settle again
      await assert.rejects(
        tradeAsBob.write.settleTrade([0n]),
        /TradeAlreadySettled/
      );
    });

    it("Should fail if trade is expired", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);
      await tokenB.write.transfer([bob.account.address, parseEther("1000")]);

      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 2n; // Very short expiry

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      // Mine blocks to pass the expiry
      await publicClient.request({
        method: "evm_increaseTime" as any,
        params: [10]
      });
      await publicClient.request({
        method: "evm_mine" as any,
        params: []
      });

      const tokenBBob = await viem.getContractAt("TokenB", tokenB.address, { client: { wallet: bob } });
      await tokenBBob.write.approve([trade.address, parseEther("200")]);

      const tradeAsBob = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: bob } });
      await assert.rejects(
        tradeAsBob.write.settleTrade([0n]),
        /TradeExpired/
      );
    });
  });

  describe("cancelExpiredTrade", function () {
    it("Should allow cancellation of expired trade and return tokens to seller", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);

      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 2n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      const aliceBalanceBefore = await tokenA.read.balanceOf([alice.account.address]);

      // Mine blocks to pass expiry
      await publicClient.request({
        method: "evm_increaseTime" as any,
        params: [10]
      });
      await publicClient.request({
        method: "evm_mine" as any,
        params: []
      });

      // Cancel expired trade
      await trade.write.cancelExpiredTrade([0n]);

      const aliceBalanceAfter = await tokenA.read.balanceOf([alice.account.address]);
      assert.equal(aliceBalanceAfter - aliceBalanceBefore, parseEther("100"));
    });

    it("Should fail if trade is not expired", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);

      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      await assert.rejects(
        trade.write.cancelExpiredTrade([0n]),
        /TradeNotExpired/
      );
    });
  });

  describe("withdrawFee", function () {
    it("Should allow owner to withdraw accumulated fees", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      // Setup and complete a trade
      await tokenA.write.transfer([alice.account.address, parseEther("1000")]);
      await tokenB.write.transfer([bob.account.address, parseEther("1000")]);

      const tokenAAsAlice = await viem.getContractAt("TokenA", tokenA.address, { client: { wallet: alice } });
      await tokenAAsAlice.write.approve([trade.address, parseEther("100")]);

      const block = await publicClient.getBlock();
      const expiry = block.timestamp + 3600n;

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });
      await tradeAsAlice.write.setupTrade([tokenA.address, parseEther("100"), parseEther("200"), expiry]);

      const tokenBBob = await viem.getContractAt("TokenB", tokenB.address, { client: { wallet: bob } });
      await tokenBBob.write.approve([trade.address, parseEther("200")]);

      const tradeAsBob = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: bob } });
      await tradeAsBob.write.settleTrade([0n]);

      const ownerBalanceBefore = await tokenA.read.balanceOf([owner.account.address]);

      // Owner withdraws fees
      const hash = await trade.write.withdrawFee();

      const ownerBalanceAfter = await tokenA.read.balanceOf([owner.account.address]);
      assert.equal(ownerBalanceAfter - ownerBalanceBefore, parseEther("0.1"));

      // Check event
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: trade.address,
        abi: trade.abi,
        eventName: "FeeWithdrawn",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.amount, parseEther("0.1"));
    });

    it("Should fail if non-owner tries to withdraw fees", async function () {
      const tokenA = await viem.deployContract("TokenA");
      const tokenB = await viem.deployContract("TokenB");
      const trade = await viem.deployContract("TokenTrade", [tokenA.address, tokenB.address]);

      const tradeAsAlice = await viem.getContractAt("TokenTrade", trade.address, { client: { wallet: alice } });

      await assert.rejects(
        tradeAsAlice.write.withdrawFee(),
        /OwnableUnauthorizedAccount/
      );
    });
  });
});
