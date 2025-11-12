const http = require('http');
const url = require('url');

// Current on-chain Merkle root for epoch 0 (from RewardEscrowV2)
const MERKLE_ROOT = '0x295af571991f634ad5203815d9ffe48c2c17c240047584cf40bba9fd2b976a64';

const srv = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (u.pathname === '/' || u.pathname === '/health') {
    res.end(JSON.stringify({ ok: true, time: Date.now() }));
  } else if (u.pathname === '/api/fah/verify-workunit' && req.method === 'POST') {
    // Return a shape matching FAHVerificationResult
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const username = parsed.username || 'TestUser';
        res.end(JSON.stringify({
          success: true,
          username,
          totalCredits: 50000,
          workUnits: 1,
          rewardAmount: '50.0 GWC',
          lastUpdated: new Date().toISOString()
        }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, username: 'unknown', totalCredits: 0, workUnits: 0, rewardAmount: '0 GWC', lastUpdated: new Date().toISOString(), error: 'Bad JSON' }));
      }
    });
  } else if (u.pathname.startsWith('/api/fah/claims/')) {
    // PendingClaimsResponse shape
    const wallet = decodeURIComponent(u.pathname.split('/').pop() || '0x0');
    res.end(JSON.stringify({
      success: true,
      walletAddress: wallet,
      totalPendingReward: '50.0 GWC',
      claims: [
        {
          username: 'TestUser',
          totalCredits: 50000,
          lastClaimedCredits: 0,
          claimableCredits: 50000,
          claimableReward: '50.0 GWC',
          verified: true,
          lastUpdated: new Date().toISOString()
        }
      ]
    }));
  } else if (u.pathname.startsWith('/api/fah/proof/')) {
    // MerkleProofResponse shape: /api/fah/proof/:wallet/:username
    // Using index=0, 50 GWC, empty proof (single-leaf test mode matching your successful script claim)
    const parts = u.pathname.split('/');
    const walletAddress = parts[4] || '0x0';
    const fahUsername = decodeURIComponent(parts[5] || 'TestUser');
    res.end(JSON.stringify({
      success: true,
      walletAddress,
      fahUsername,
      proof: [],
      merkleRoot: MERKLE_ROOT,
      index: 0,
      amount: '50000000000000000000',
      claimableCredits: 50000
    }));
  } else if (u.pathname === '/api/merkle/root') {
    res.end(JSON.stringify({ 
      merkleRoot: MERKLE_ROOT, 
      epoch: 0 
    }));
  } else {
    res.end(JSON.stringify({ ok: true, path: u.pathname }));
  }
});

srv.listen(3000, '127.0.0.1', () => {
  console.log('Stub backend listening on http://127.0.0.1:3000');
});
