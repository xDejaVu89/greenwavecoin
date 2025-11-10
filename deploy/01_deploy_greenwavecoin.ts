import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log(`Deploying GreenWaveCoin to ${network.name} with deployer ${deployer}`);

  const deployResult = await deploy('GreenWaveCoin', {
    from: deployer,
    proxy: {
      proxyContract: "UUPSProxy",
      execute: {
        methodName: "initialize",
        args: [
          "GreenWaveCoin", // name
          "GWC",          // symbol
          deployer        // owner
        ],
      },
    },
    log: true,
    waitConfirmations: network.name === 'hardhat' ? 1 : 5
  });

  // Determine API key based on network
  const getVerifyApiKey = (networkName: string) => {
    const keyMap: { [key: string]: string | undefined } = {
      polygon: process.env.POLYGONSCAN_API_KEY,
      mumbai: process.env.POLYGONSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
      arbitrum: process.env.ARBISCAN_API_KEY,
      arbitrumGoerli: process.env.ARBISCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      baseGoerli: process.env.BASESCAN_API_KEY
    };
    return keyMap[networkName];
  };

  // Verify on supported networks
  if (!['hardhat', 'localhost'].includes(network.name)) {
    const apiKey = getVerifyApiKey(network.name);
    if (apiKey) {
      try {
        console.log('Verifying implementation contract...');
        await hre.run('verify:verify', {
          address: deployResult.implementation,
          constructorArguments: []
        });
        
        console.log('Verifying proxy contract...');
        await hre.run('verify:verify', {
          address: deployResult.address,
          constructorArguments: []
        });
        
        console.log('Contracts verified on explorer');
      } catch (error) {
        console.log('Verification failed:', error);
      }
    } else {
      console.log(`Skipping verification - no API key found for ${network.name}`);
    }
  }

  console.log('Deployment addresses:');
  console.log('Proxy:', deployResult.address);
  console.log('Implementation:', deployResult.implementation);
  return true;
};

func.tags = ['GreenWaveCoin'];
func.id = 'deploy_greenwavecoin';

export default func;