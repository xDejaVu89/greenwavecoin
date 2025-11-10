import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GreenWaveCoin Gas Optimizations", function () {
  let token: Contract;
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
      deployer.address // Use deployer as treasury for gas tests
    ], { initializer: 'initialize', kind: 'uups' })) as any;
  });

  async function measureGas(tx: Promise<any>): Promise<bigint> {
    const receipt = await (await tx).wait();
    return receipt?.gasUsed ?? 0n;
  }

  describe("Gas Benchmarks", function () {
    it("benchmarks basic operations", async function () {
      const amount = ethers.parseUnits("100", 18);
      
      // First transfer is more expensive due to cold storage
      const firstTransferGas = await measureGas(
        token.transfer(users[0].address, amount)
      );
      
      // Second transfer to same address is cheaper (warm storage)
      const secondTransferGas = await measureGas(
        token.transfer(users[0].address, amount)
      );
      
      // First approval
      const firstApprovalGas = await measureGas(
        token.approve(users[1].address, amount)
      );
      
      // TransferFrom after approval
      await token.approve(users[2].address, amount);
      const transferFromGas = await measureGas(
        token.connect(users[2]).transferFrom(deployer.address, users[3].address, amount)
      );

      console.log({
        firstTransferGas: firstTransferGas.toString(),
        secondTransferGas: secondTransferGas.toString(),
        firstApprovalGas: firstApprovalGas.toString(),
        transferFromGas: transferFromGas.toString()
      });

      // Verify gas savings on warm storage
      expect(secondTransferGas).to.be.lessThan(firstTransferGas);
    });

    it("benchmarks batch operations", async function () {
      const amount = ethers.parseUnits("1", 18);
      const batchSize = 5;
      let totalGas = 0n;
      
      // Sequential transfers
      for (let i = 0; i < batchSize; i++) {
        const gas = await measureGas(
          token.transfer(users[i].address, amount)
        );
        totalGas += gas;
      }
      
      const avgGas = totalGas / BigInt(batchSize);
      console.log({
        totalGasForBatch: totalGas.toString(),
        averageGasPerTransfer: avgGas.toString()
      });
    });

    it("measures gas for different amounts", async function () {
      const amounts = [
        ethers.parseUnits("0.000001", 18), // tiny amount
        ethers.parseUnits("1", 18),        // 1 token
        ethers.parseUnits("100", 18),      // medium amount
        ethers.parseUnits("1000", 18)      // large amount
      ];
      
      const results = [];
      for (const amount of amounts) {
        const gas = await measureGas(
          token.transfer(users[0].address, amount)
        );
        results.push({
          amount: ethers.formatUnits(amount, 18),
          gas: gas.toString()
        });
      }
      
      console.log("Gas usage for different amounts:", results);
      
      // Verify gas cost is relatively constant regardless of amount
      const gasValues = results.map(r => BigInt(r.gas));
      const maxGasDiff = Number(gasValues.reduce((a, b) => a > b ? a - b : b - a));
      expect(maxGasDiff).to.be.lessThan(20000); // Allow for cold vs warm storage difference
    });
  });
});