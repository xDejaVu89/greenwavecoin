import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("RewardEscrowV2 with SimpleStaking", function () {
  let token: any;
  let escrow: any;
  let staking: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let accounts: any[];

  before(async () => {
    accounts = await ethers.getSigners();
    [owner, user1, user2] = accounts;
  });

  beforeEach(async () => {
    const Token = await ethers.getContractFactory("GreenWaveCoin");
    token = await Token.deploy();
    await token.initializeWithSupply(
      "GreenWaveCoin",
      "GWC",
      await owner.getAddress(),
      await owner.getAddress(),
      1_000_000
    );
    const Staking = await ethers.getContractFactory("SimpleStaking");
    staking = await Staking.deploy(token.target, ethers.parseEther("100"));
    const Escrow = await ethers.getContractFactory("RewardEscrowV2");
    escrow = await Escrow.deploy(token.target);
    await escrow.setStakingRequirement(staking.target);
    await token.transfer(await user1.getAddress(), ethers.parseEther("200"));
    await token.transfer(await user2.getAddress(), ethers.parseEther("200"));
    await token.transfer(escrow.target, ethers.parseEther("1000"));
  });

  function makeLeaf(index: number, account: string, amount: string) {
    return Buffer.from(
      ethers.solidityPackedKeccak256([
        "uint256",
        "address",
        "uint256"
      ], [index, account, amount]).slice(2),
      "hex"
    );
  }

  it("enforces staking requirement for claims", async () => {
    const epoch = 1;
    const claims = [
      { index: 0, account: await user1.getAddress(), amount: ethers.parseEther("10") },
      { index: 1, account: await user2.getAddress(), amount: ethers.parseEther("20") },
    ];
    const leaves = claims.map(c => makeLeaf(c.index, c.account, c.amount.toString()));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    const total = ethers.parseEther("30");
    await escrow.setMerkleRoot(epoch, root, total);
    // User1 tries to claim without staking
    const proof1 = tree.getHexProof(leaves[0]);
    await expect(
      escrow.connect(user1).claim(epoch, 0, await user1.getAddress(), ethers.parseEther("10"), proof1)
    ).to.be.rejectedWith("stake required");
    // User1 stakes and claims
    await token.connect(user1).approve(staking.target, ethers.parseEther("100"));
    await staking.connect(user1).stake(ethers.parseEther("100"));
    await escrow.connect(user1).claim(epoch, 0, await user1.getAddress(), ethers.parseEther("10"), proof1);
    // User2 stakes less than required
    await token.connect(user2).approve(staking.target, ethers.parseEther("50"));
    await staking.connect(user2).stake(ethers.parseEther("50"));
    const proof2 = tree.getHexProof(leaves[1]);
    await expect(
      escrow.connect(user2).claim(epoch, 1, await user2.getAddress(), ethers.parseEther("20"), proof2)
    ).to.be.rejectedWith("stake required");
    // User2 tops up and claims
    await token.connect(user2).approve(staking.target, ethers.parseEther("50"));
    await staking.connect(user2).stake(ethers.parseEther("50"));
    await escrow.connect(user2).claim(epoch, 1, await user2.getAddress(), ethers.parseEther("20"), proof2);
  });
});
