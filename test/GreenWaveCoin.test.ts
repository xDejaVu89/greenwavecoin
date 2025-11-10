import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GreenWaveCoin } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GreenWaveCoin", function () {
  let token: GreenWaveCoin;
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  const TOTAL_SUPPLY = ethers.parseUnits("1000000", 18);

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [deployer, user1, user2] = signers;
    const treasury = signers[3].address; // use a separate account as treasury to avoid conflicts
    const Factory = await ethers.getContractFactory("GreenWaveCoin");
    token = (await upgrades.deployProxy(Factory, [
      "GreenWaveCoin",
      "GWV",
      deployer.address,
      treasury
    ], { initializer: 'initialize', kind: 'uups' })) as any;
  });

  describe("Deployment", function () {
    it("mints total supply to deployer", async function () {
      const total = await token.totalSupply();
      const balance = await token.balanceOf(deployer.address);
      
      expect(balance).to.equal(total);
      expect(total).to.equal(TOTAL_SUPPLY);
    });

    it("sets correct token metadata", async function () {
      expect(await token.name()).to.equal("GreenWaveCoin");
      expect(await token.symbol()).to.equal("GWV");
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("Transfers", function () {
    const amount = ethers.parseUnits("100", 18);

    it("allows transfers between accounts", async function () {
      // Note initial balances
      const deployerInitial = await token.balanceOf(deployer.address);
      
      // First transfer: deployer -> user1
      await expect(token.transfer(user1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(deployer.address, user1.address, amount); // Full amount in event
      
      // Check balances reflect fee deduction
      const expectedNet = amount * 99n / 100n; // 1% fee deducted
      expect(await token.balanceOf(user1.address)).to.equal(expectedNet);
      expect(await token.balanceOf(deployer.address))
        .to.equal(deployerInitial - amount);

      // Second transfer: user1 -> user2 (half of received amount)
      const transferAmount = expectedNet / 2n;
      await expect(token.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount); // Full amount in event
      
      // Verify final balances
      expect(await token.balanceOf(user2.address))
        .to.equal(transferAmount * 99n / 100n); // Recipient gets 99%
      expect(await token.balanceOf(user1.address))
        .to.equal(expectedNet - transferAmount); // Sender's balance reduced by full amount
    });

    it("emits Transfer events", async function () {
      const net = amount * 99n / 100n; // 1% fee

      await expect(token.transfer(user1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(deployer.address, user1.address, amount); // Full amount in event
    });

    it("reverts on insufficient balance", async function () {
      const tooMuch = TOTAL_SUPPLY + ethers.parseUnits("1", 18);
      await expect(token.transfer(user1.address, tooMuch))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Allowances", function () {
    const amount = ethers.parseUnits("100", 18);

    beforeEach(async function () {
      await token.transfer(user1.address, amount);
    });

    it("allows approval and transferFrom", async function () {
      const user1Balance = await token.balanceOf(user1.address);
      const approveAmount = user1Balance / 2n; // Approve half of current balance

      // Approve user2 to spend tokens
      await token.connect(user1).approve(user2.address, approveAmount);
      expect(await token.allowance(user1.address, user2.address))
        .to.equal(approveAmount);

      // User2 transfers using the approval
      await token.connect(user2).transferFrom(user1.address, user2.address, approveAmount);

      // Check final balances and allowance
      expect(await token.balanceOf(user2.address))
        .to.equal(approveAmount * 99n / 100n); // 1% fee deducted
      expect(await token.balanceOf(user1.address))
        .to.equal(user1Balance - approveAmount); // Full amount deducted
      expect(await token.allowance(user1.address, user2.address))
        .to.equal(0); // Allowance fully used
    });

    it("emits Approval events", async function () {
      await expect(token.connect(user1).approve(user2.address, amount))
        .to.emit(token, "Approval")
        .withArgs(user1.address, user2.address, amount);
    });

    it("prevents unauthorized transferFrom", async function () {
      await expect(token.connect(user2).transferFrom(user1.address, user2.address, amount))
        .to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("allows updating allowances", async function () {
      // First approval
      await token.connect(user1).approve(user2.address, amount);
      expect(await token.allowance(user1.address, user2.address)).to.equal(amount);
      
      // Increase by approving more
      await token.connect(user1).approve(user2.address, amount * 2n);
      expect(await token.allowance(user1.address, user2.address)).to.equal(amount * 2n);
      
      // Decrease by approving less
      await token.connect(user1).approve(user2.address, amount);
      expect(await token.allowance(user1.address, user2.address)).to.equal(amount);
    });
  });
});