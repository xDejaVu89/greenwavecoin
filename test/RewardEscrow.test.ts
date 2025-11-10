import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("RewardEscrow", function () {
  let token: Contract;
  let escrow: any;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let accounts: Signer[];

  before(async () => {
    accounts = await ethers.getSigners();
    [owner, user1, user2] = accounts;
  });

  beforeEach(async () => {
    const Token = await ethers.getContractFactory("GreenWaveCoin");
    token = await Token.deploy();
    // ethers v6: no .deployed(), contract is ready after deploy
    await token.initializeWithSupply(
      "GreenWaveCoin",
      "GWC",
      await owner.getAddress(),
      await owner.getAddress(),
      1_000_000 // initial supply in whole tokens
    );

    const Escrow = await ethers.getContractFactory("RewardEscrow");
    escrow = await Escrow.deploy(token.target);
    // Fund escrow
    await token.transfer(
      escrow.target,
      ethers.parseEther("1000")
    );
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

  it("allows owner to set merkle root and users to claim", async () => {
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
    // User1 claims
    const proof1 = tree.getHexProof(leaves[0]);
    await escrow.connect(user1).claim(epoch, 0, await user1.getAddress(), ethers.parseEther("10"), proof1);
    // User2 claims
    const proof2 = tree.getHexProof(leaves[1]);
    await escrow.connect(user2).claim(epoch, 1, await user2.getAddress(), ethers.parseEther("20"), proof2);
    // Double claim fails
    await expect(
      escrow.connect(user1).claim(epoch, 0, await user1.getAddress(), ethers.parseEther("10"), proof1)
    ).to.be.rejectedWith("already claimed");
  });

  it("rejects invalid proof", async () => {
    const epoch = 2;
    const claims = [
      { index: 0, account: await user1.getAddress(), amount: ethers.parseEther("10") },
    ];
    const leaves = claims.map(c => makeLeaf(c.index, c.account, c.amount.toString()));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    const total = ethers.parseEther("10");
    await escrow.setMerkleRoot(epoch, root, total);
    // Wrong amount
    const proof = tree.getHexProof(leaves[0]);
    await expect(
      escrow.connect(user1).claim(epoch, 0, await user1.getAddress(), ethers.parseEther("11"), proof)
    ).to.be.rejectedWith("invalid proof");
  });
});
