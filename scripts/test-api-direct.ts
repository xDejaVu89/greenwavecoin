import axios from 'axios';

async function testDirect() {
  console.log('Testing direct FAH API call...\n');
  
  try {
    const response = await axios.get('https://api.foldingathome.org/user/Anonymous', {
      timeout: 10000,
      headers: {
        'User-Agent': 'GreenWaveCoin/1.0'
      }
    });
    
    console.log('✅ API call successful!');
    console.log('Response data:', JSON.stringify(response.data, null, 2).substring(0, 500));
    console.log('\nUser:', response.data.name);
    console.log('Score:', response.data.score?.toLocaleString());
    console.log('Work Units:', response.data.wus?.toLocaleString());
    console.log('Teams count:', response.data.teams?.length);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testDirect();
