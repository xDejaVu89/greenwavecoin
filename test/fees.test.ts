import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Fee handling", function () {
  let token: any;
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let staking: HardhatEthersSigner;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [deployer, user1, user2, treasury, staking] = signers;

    const Factory = await ethers.getContractFactory("GreenWaveCoin");
    token = await upgrades.deployProxy(Factory, [
      "GreenWaveCoin",
      "GWV",
      deployer.address,
      treasury.address
    ], { initializer: 'initialize', kind: 'uups' });
  });

  it("does not take fees for very small amounts due to rounding", async function () {
    // default fee 1% -> on amount=1 the fee is 0 due to integer math
    const tiny = 1n;
    const beforeSender = await token.balanceOf(deployer.address);
    const beforeRecipient = await token.balanceOf(user1.address);

    await token.transfer(user1.address, tiny);

    expect(await token.balanceOf(user1.address)).to.equal(beforeRecipient + tiny);
    expect(await token.balanceOf(deployer.address)).to.equal(beforeSender - tiny);
  });

  it("splits fee correctly between burn, staking and treasury", async function () {
    // enable staking contract and set clear amounts for easier math
    await token.setStakingContract(staking.address);
    // Use a deterministic amount where fee math is exact
    const amount = ethers.parseUnits("10000", 18); // fee = 0.3% (30 bps) -> 3

    // default shares: burn 20% -> 0.6, staking 30% -> 0.9, treasury 50 -> 1.5 of fee
    const fee = amount * 30n / 10000n; // 0.3% = 30 basis points
    const burn = fee * 2000n / 10000n;
    const stake = fee * 3000n / 10000n;
    const treasuryAmt = fee - burn - stake;

    const beforeTotal = await token.totalSupply();
    const beforeTreasury = await token.balanceOf(treasury.address);
    const beforeStaking = await token.balanceOf(staking.address);

    await token.transfer(user1.address, amount);

    // recipient gets net amount
    expect(await token.balanceOf(user1.address)).to.equal(amount - fee);

    // staking and treasury receive their portions
    expect(await token.balanceOf(staking.address)).to.equal(beforeStaking + stake);
    expect(await token.balanceOf(treasury.address)).to.equal(beforeTreasury + treasuryAmt);

    // total supply reduced by burn amount
    expect(await token.totalSupply()).to.equal(beforeTotal - burn);
  });

  it("zero-fee mode transfers full amount", async function () {
    // cast to any for updateFees if TypeChain doesn't include it
    await (token as any).updateFees(0, 0, 0);
    const amount = ethers.parseUnits("42", 18);
    const before = await token.balanceOf(user2.address);

    await token.transfer(user2.address, amount);
    expect(await token.balanceOf(user2.address)).to.equal(before + amount);
  });

  it("rejects fee updates above max allowed", async function () {
    await expect((token as any).updateFees(1001, 0, 0))
      .to.be.revertedWithCustomError(token, "FeeTooHigh");
  });
});
