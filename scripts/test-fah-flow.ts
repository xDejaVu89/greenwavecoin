import axios from 'axios';

const BACKEND_URL = 'http://localhost:3000';
const TEST_WALLET = '0x6D51d80017C66afBeD44D50c775f46C60Bbb56af'; // Your deployer wallet
const TEST_USERNAME = 'Anonymous'; // Common FAH username

async function testFlow() {
  console.log('🧪 Testing complete FAH verification and Merkle proof flow\n');
  
  try {
    // Step 1: Verify FAH username
    console.log(`1️⃣ Verifying FAH username: ${TEST_USERNAME}`);
    const verifyResponse = await axios.post(`${BACKEND_URL}/api/fah/verify-workunit`, {
      username: TEST_USERNAME,
      walletAddress: TEST_WALLET
    });
    
    if (verifyResponse.data.success) {
      console.log(`   ✅ Verified: ${verifyResponse.data.totalCredits.toLocaleString()} credits`);
      console.log(`   💰 Reward: ${verifyResponse.data.rewardAmount} GWC\n`);
    } else {
      console.error(`   ❌ Verification failed: ${verifyResponse.data.error}\n`);
      return;
    }

    // Step 2: Get pending claims
    console.log(`2️⃣ Fetching pending claims for wallet...`);
    const claimsResponse = await axios.get(`${BACKEND_URL}/api/fah/claims/${TEST_WALLET}`);
    
    if (claimsResponse.data.success) {
      console.log(`   ✅ Total pending: ${claimsResponse.data.totalPendingReward}`);
      console.log(`   📋 Claims: ${claimsResponse.data.claims.length}\n`);
    } else {
      console.error(`   ❌ Failed to get claims\n`);
      return;
    }

    // Step 3: Get Merkle proof
    console.log(`3️⃣ Generating Merkle proof...`);
    const proofResponse = await axios.get(
      `${BACKEND_URL}/api/fah/proof/${TEST_WALLET}/${encodeURIComponent(TEST_USERNAME)}`
    );
    
    if (proofResponse.data.success) {
      console.log(`   ✅ Proof generated!`);
      console.log(`   📜 Root: ${proofResponse.data.merkleRoot}`);
      console.log(`   🔢 Index: ${proofResponse.data.index}`);
      console.log(`   💎 Amount: ${proofResponse.data.amount} GWC`);
      console.log(`   🔐 Proof length: ${proofResponse.data.proof.length} hashes\n`);
    } else {
      console.error(`   ❌ Failed to get proof: ${proofResponse.data.error}\n`);
      return;
    }

    // Step 4: Get Merkle root
    console.log(`4️⃣ Fetching current Merkle root...`);
    const rootResponse = await axios.get(`${BACKEND_URL}/api/fah/merkle-root`);
    
    if (rootResponse.data.success) {
      console.log(`   ✅ Root: ${rootResponse.data.root}`);
      if (rootResponse.data.claimCount !== undefined) {
        console.log(`   📊 Claims in tree: ${rootResponse.data.claimCount}\n`);
      }
    }

    console.log('🎉 All tests passed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Start the backend: cd backend && npm run dev');
    console.log('   2. Set Merkle root on contract: npx hardhat run scripts/set-merkle-root.ts --network amoy');
    console.log('   3. Open desktop app and try claiming rewards!');

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Backend not running!');
      console.log('   Start it with: cd backend && npm run dev\n');
    } else if (error.response) {
      console.error(`\n❌ Error: ${error.response.data.error || error.message}\n`);
    } else {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
  }
}

testFlow();
