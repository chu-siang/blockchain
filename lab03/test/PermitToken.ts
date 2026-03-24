import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, keccak256, encodePacked, hexToBytes } from "viem";

describe("PermitToken", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, alice, bob, carol] = await viem.getWalletClients();

  async function signPermit(
    tokenAddress: `0x${string}`,
    signerWallet: typeof alice,
    ownerAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    value: bigint,
    nonce: bigint,
    deadline: bigint
  ): Promise<`0x${string}`> {
    const hash = keccak256(
      encodePacked(
        ["address", "address", "uint256", "uint256", "uint256", "address"],
        [ownerAddress, spenderAddress, value, nonce, deadline, tokenAddress]
      )
    );
    return signerWallet.signMessage({ message: { raw: hexToBytes(hash) } });
  }

  describe("Basic ERC20", function () {
    it("should have correct name, symbol, decimals, and total supply", async function () {
      const token = await viem.deployContract("PermitToken");

      assert.equal(await token.read.name(), "Permit Token");
      assert.equal(await token.read.symbol(), "PMIT");
      assert.equal(await token.read.decimals(), 18);
      assert.equal(await token.read.totalSupply(), parseEther("100000000"));
    });

    it("deployer should receive all tokens on deployment", async function () {
      const token = await viem.deployContract("PermitToken");

      assert.equal(
        await token.read.balanceOf([owner.account.address]),
        parseEther("100000000")
      );
    });
  });

  describe("Signature Verification", function () {
    it("valid signature successfully executes permit", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;
      const nonce = await token.read.nonces([alice.account.address]);

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline
      );

      await token.write.permit([
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline,
        sig,
      ]);

      assert.equal(
        await token.read.allowance([alice.account.address, bob.account.address]),
        parseEther("500")
      );
    });

    it("signature from wrong signer fails", async function () {
      const token = await viem.deployContract("PermitToken");

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;
      const nonce = await token.read.nonces([alice.account.address]);

      // Carol signs but we claim it is Alice's permit
      const sig = await signPermit(
        token.address,
        carol,
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline
      );

      await assert.rejects(
        token.write.permit([
          alice.account.address,
          bob.account.address,
          parseEther("500"),
          nonce,
          deadline,
          sig,
        ]),
        /invalid signature/i
      );
    });
  });

  describe("Nonce Protection", function () {
    it("nonce increases after successful permit", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const nonceBefore = await token.read.nonces([alice.account.address]);
      assert.equal(nonceBefore, 0n);

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("100"),
        nonceBefore,
        deadline
      );

      await token.write.permit([
        alice.account.address,
        bob.account.address,
        parseEther("100"),
        nonceBefore,
        deadline,
        sig,
      ]);

      const nonceAfter = await token.read.nonces([alice.account.address]);
      assert.equal(nonceAfter, 1n);
    });

    it("reusing the same signature fails", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;
      const nonce = await token.read.nonces([alice.account.address]);

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("100"),
        nonce,
        deadline
      );

      // First use succeeds
      await token.write.permit([
        alice.account.address,
        bob.account.address,
        parseEther("100"),
        nonce,
        deadline,
        sig,
      ]);

      // Reusing same signature (old nonce) fails
      await assert.rejects(
        token.write.permit([
          alice.account.address,
          bob.account.address,
          parseEther("100"),
          nonce,
          deadline,
          sig,
        ]),
        /invalid nonce/i
      );
    });
  });

  describe("Expiry", function () {
    it("expired signature fails", async function () {
      const token = await viem.deployContract("PermitToken");

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 2n;
      const nonce = await token.read.nonces([alice.account.address]);

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("100"),
        nonce,
        deadline
      );

      // Advance time past deadline
      await publicClient.request({
        method: "evm_increaseTime" as any,
        params: [10],
      });
      await publicClient.request({
        method: "evm_mine" as any,
        params: [],
      });

      await assert.rejects(
        token.write.permit([
          alice.account.address,
          bob.account.address,
          parseEther("100"),
          nonce,
          deadline,
          sig,
        ]),
        /expired/i
      );
    });
  });

  describe("Allowance", function () {
    it("allowance is correctly updated after permit", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;
      const nonce = await token.read.nonces([alice.account.address]);

      assert.equal(
        await token.read.allowance([alice.account.address, bob.account.address]),
        0n
      );

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline
      );

      await token.write.permit([
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline,
        sig,
      ]);

      assert.equal(
        await token.read.allowance([alice.account.address, bob.account.address]),
        parseEther("500")
      );
    });

    it("transferFrom() works after permit", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const block = await publicClient.getBlock();
      const deadline = block.timestamp + 3600n;
      const nonce = await token.read.nonces([alice.account.address]);

      const sig = await signPermit(
        token.address,
        alice,
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline
      );

      await token.write.permit([
        alice.account.address,
        bob.account.address,
        parseEther("500"),
        nonce,
        deadline,
        sig,
      ]);

      const tokenAsBob = await viem.getContractAt("PermitToken", token.address, {
        client: { wallet: bob },
      });
      await tokenAsBob.write.transferFrom([
        alice.account.address,
        bob.account.address,
        parseEther("300"),
      ]);

      assert.equal(
        await token.read.balanceOf([bob.account.address]),
        parseEther("300")
      );
      assert.equal(
        await token.read.balanceOf([alice.account.address]),
        parseEther("700")
      );
    });

    it("transferFrom() fails if permit was not executed", async function () {
      const token = await viem.deployContract("PermitToken");
      await token.write.transfer([alice.account.address, parseEther("1000")]);

      const tokenAsBob = await viem.getContractAt("PermitToken", token.address, {
        client: { wallet: bob },
      });

      await assert.rejects(
        tokenAsBob.write.transferFrom([
          alice.account.address,
          bob.account.address,
          parseEther("300"),
        ]),
        /ERC20InsufficientAllowance/
      );
    });
  });
});
