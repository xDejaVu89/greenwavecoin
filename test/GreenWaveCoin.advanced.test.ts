import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GreenWaveCoin } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GreenWaveCoin Advanced Tests", function () {
  let token: GreenWaveCoin;
  let deployer: HardhatEthersSigner;
  let users: HardhatEthersSigner[];
  const TOTAL_SUPPLY = ethers.parseUnits("1000000", 18);

  beforeEach(async function () {
    [deployer, ...users] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GreenWaveCoin");
    token = (await upgrades.deployProxy(Factory, [
      "GreenWaveCoin",
      "GWV",
      deployer.address,
      users[0].address // Use a distinct treasury (first user) for advanced tests
    ], { initializer: 'initialize', kind: 'uups' })) as any;
  });

  describe("Stress Tests", function () {
    it("handles multiple transfers in sequence", async function () {
      const amount = ethers.parseUnits("1", 18);
      const numTransfers = 10;
      // Disable fees for pure transfer stress test to avoid cascading fee effects
      await token.updateFees(0, 0, 0);

      // Transfer tokens to first user
      await token.transfer(users[0].address, amount * BigInt(numTransfers));
      
      // Chain of transfers between users
      for (let i = 0; i < numTransfers - 1; i++) {
        await token.connect(users[i]).transfer(users[i + 1].address, amount);
      }
      
      // Verify final balances
      expect(await token.balanceOf(users[numTransfers - 1].address))
        .to.equal(amount);
    });

    it("handles parallel approvals", async function () {
      const amount = ethers.parseUnits("10", 18);
      const approvalPromises = users.slice(0, 5).map(user =>
        token.approve(user.address, amount)
      );
      
      await Promise.all(approvalPromises);
      
      // Verify all approvals
      for (const user of users.slice(0, 5)) {
        expect(await token.allowance(deployer.address, user.address))
          .to.equal(amount);
      }
    });
  });

  describe("Edge Cases", function () {
    it("handles zero transfers", async function () {
      const initialBalance = await token.balanceOf(deployer.address);
      await token.transfer(users[0].address, 0);
      expect(await token.balanceOf(deployer.address)).to.equal(initialBalance);
    });

    it("handles zero approvals", async function () {
      await token.approve(users[0].address, 0);
      expect(await token.allowance(deployer.address, users[0].address))
        .to.equal(0);
    });

    it("prevents transfers to zero address", async function () {
      const amount = ethers.parseUnits("1", 18);
      await expect(token.transfer(ethers.ZeroAddress, amount))
        .to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("prevents approvals to zero address", async function () {
      await expect(token.approve(ethers.ZeroAddress, ethers.parseUnits("1", 18)))
        .to.be.revertedWith("ERC20: approve to the zero address");
    });
  });

  describe("Transfer Patterns", function () {
    // For these pattern tests we want no fees so balances behave simply
    beforeEach(async function () {
      // cast to any to avoid TypeChain typing mismatch for test helper call
      await (token as any).updateFees(0, 0, 0);
    });
    it("allows transferring entire balance", async function () {
      const balance = await token.balanceOf(deployer.address);
      await token.transfer(users[0].address, balance);
      expect(await token.balanceOf(deployer.address)).to.equal(0);
      expect(await token.balanceOf(users[0].address)).to.equal(balance);
    });

    it("handles multiple small transfers", async function () {
      const amount = ethers.parseUnits("0.0001", 18);
      const count = 5;
      let totalSent = 0n;
      
      for (let i = 0; i < count; i++) {
        await token.transfer(users[0].address, amount);
        totalSent += amount;
      }
      
      expect(await token.balanceOf(users[0].address)).to.equal(totalSent);
    });
  });

  describe("Permission Scenarios", function () {
    const amount = ethers.parseUnits("100", 18);

    beforeEach(async function () {
      await token.transfer(users[0].address, amount * 2n);
    });

    it("handles approval transitions", async function () {
      // Initial approval
      await token.connect(users[0]).approve(users[1].address, amount);
      
      // Use partial allowance
      await token.connect(users[1]).transferFrom(
        users[0].address,
        users[2].address,
        amount / 2n
      );
      
      // Verify remaining allowance
      expect(await token.allowance(users[0].address, users[1].address))
        .to.equal(amount / 2n);
      
      // Complete allowance usage
      await token.connect(users[1]).transferFrom(
        users[0].address,
        users[2].address,
        amount / 2n
      );
      
      // Verify zero allowance
      expect(await token.allowance(users[0].address, users[1].address))
        .to.equal(0);
    });
  });
});