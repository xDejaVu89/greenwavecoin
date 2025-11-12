const { ethers } = require("hardhat");

async function main() {
  const gwcAddress = "0x6D938b4C48300A29905FBa272cCdC1207538865f";
  const GWC = await ethers.getContractAt("GreenWaveCoin", gwcAddress);
  
  const supply = await GWC.totalSupply();
  console.log("Current Total Supply:", ethers.formatEther(supply), "GWC");
  console.log("Raw value:", supply.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
