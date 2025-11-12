import React, { useState } from 'react';
import { ethers } from 'ethers';
import { backendService, PendingClaim } from '../services/backend.service';
import { useWalletStore } from '../store/wallet';
import { claimRewards, getContracts } from '../utils/contracts';

export const FAHRewardsCard: React.FC = () => {
  const { address } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [totalReward, setTotalReward] = useState<string>('0 GWC');
  const [username, setUsername] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Don't auto-load on mount - only load after verification or manual refresh
  // This prevents "failed to fetch" errors when no FAH username is verified yet

  const loadPendingClaims = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await backendService.getPendingClaims(address);
      
      if (response.success) {
        setClaims(response.claims);
        setTotalReward(response.totalPendingReward);
      } else {
        setError(response.error || 'Failed to load pending claims');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pending claims');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!address || !username.trim()) return;
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const result = await backendService.verifyFAHContributions(username.trim(), address);
      if (result.success) {
        setVerifyMessage(`Verified ${result.username}: ${result.totalCredits.toLocaleString()} credits → ${result.rewardAmount} GWC claimable`);
        await loadPendingClaims();
      } else {
        setVerifyMessage(result.error || 'Verification failed');
      }
    } catch (e: any) {
      setVerifyMessage(e.message || 'Verification error');
    } finally {
      setVerifying(false);
    }
  };

  const handleClaim = async () => {
    if (!address || claims.length === 0) return;
    
    setClaiming(true);
    setClaimMessage(null);
    setError(null);
    
    try {
      // Get MetaMask provider
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const network = await provider.getNetwork();
      
      // Check if on correct network
      const contracts = getContracts(network.chainId);
      if (!contracts || contracts.REWARD_ESCROW === '0x0000000000000000000000000000000000000000') {
        setError(`Please switch to Polygon Amoy testnet`);
        return;
      }

      // Pre-check: ensure on-chain Merkle root matches backend Merkle root
      // Use first claim's username to get the backend proof + root
      const firstUsername = claims[0]?.username;
      if (!firstUsername) {
        setError('No claimable entries found');
        return;
      }

      const precheck = await backendService.getMerkleProof(address, firstUsername);
      if (!precheck.success) {
        throw new Error(precheck.error || 'Failed to get proof for pre-check');
      }

      // Read on-chain root from escrow (epoch 0)
      const escrowReader = new ethers.Contract(
        contracts.REWARD_ESCROW,
        [
          'function merkleRoots(uint256 epoch) view returns (bytes32)'
        ],
        provider
      );
      const onChainRoot: string = await escrowReader.merkleRoots(0);
  const backendRoot: string = precheck.merkleRoot || '';

      if (!backendRoot) {
        throw new Error('Backend did not return a Merkle root');
      }

      if (onChainRoot.toLowerCase() !== backendRoot.toLowerCase()) {
        setClaimMessage(
          `Contract Merkle root doesn't match backend. On-chain: ${onChainRoot}. Backend: ${backendRoot}. ` +
          `Ask the escrow owner to update the root (epoch 0) or switch to a test escrow you own.`
        );
        return;
      }
      
      // For each pending claim, get proof and submit
      for (const claim of claims) {
        setClaimMessage(`Claiming ${claim.claimableReward} for ${claim.username}...`);
        
        // Get proof from backend
        const proofResponse = await backendService.getMerkleProof(address, claim.username);
        
        if (!proofResponse.success) {
          throw new Error(proofResponse.error || 'Failed to get proof');
        }
        
        const proof = proofResponse.proof;
        const claimIndex = proofResponse.index;
        const claimAmount = proofResponse.amount;
        
        // Submit claim transaction
        const tx = await claimRewards(
          signer,
          network.chainId,
          claimIndex,
          address,
          claimAmount,
          proof
        );
        
        setClaimMessage(`Transaction submitted: ${tx.hash}`);
        await tx.wait();
        setClaimMessage(`✅ Claimed ${claim.claimableReward}!`);
      }
      
      // Reload claims after successful claim
      setTimeout(() => {
        loadPendingClaims();
        setClaimMessage(null);
      }, 3000);
      
    } catch (e: any) {
      console.error('Claim error:', e);
      setError(e.message || 'Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  };

  if (!address) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Claimable Rewards</h3>
        <p className="text-gray-400">Connect your wallet to see claimable rewards</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Claimable Rewards</h3>
        <button
          onClick={loadPendingClaims}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Verification form */}
      <div className="mb-4 space-y-2">
        <label className="text-sm text-gray-300 block">Folding@Home Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Enter FAH donor name"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleVerify}
          disabled={!username.trim() || verifying || !address}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : 'Verify & Update Rewards'}
        </button>
        {verifyMessage && (
          <div className="text-xs mt-2 p-2 rounded bg-gray-700 border border-gray-600 text-gray-300">
            {verifyMessage}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">
          Loading pending claims...
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No pending claims</p>
          <p className="text-sm mt-2">Complete FAH work units and verify them to earn rewards</p>
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-green-900/30 border border-green-500 rounded">
            <div className="text-2xl font-bold text-green-400">{totalReward}</div>
            <div className="text-sm text-gray-400 mt-1">Total Pending Rewards</div>
          </div>

          <div className="space-y-3">
            {claims.map((claim, index) => (
              <div
                key={index}
                className="p-4 bg-gray-700 rounded border border-gray-600"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{claim.username}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Total: {claim.totalCredits.toLocaleString()} credits
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      {claim.claimableReward}
                    </div>
                    <div className="text-xs text-gray-400">
                      {claim.claimableCredits.toLocaleString()} credits
                    </div>
                  </div>
                </div>
                
                {claim.lastClaimedCredits > 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    Already claimed: {claim.lastClaimedCredits.toLocaleString()} credits
                  </div>
                )}
              </div>
            ))}
          </div>

          {claimMessage && (
            <div className="mb-4 p-3 bg-blue-900/50 border border-blue-500 rounded text-sm">
              {claimMessage}
            </div>
          )}

          <button
            onClick={handleClaim}
            className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50"
            disabled={claiming || claims.length === 0}
          >
            {claiming ? 'Claiming...' : `Claim ${totalReward}`}
          </button>
        </>
      )}
    </div>
  );
};
