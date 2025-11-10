import { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { getGWCBalance } from '../utils/contracts';

function Dashboard() {
  const { address, provider, chainId } = useWalletStore();
  const [gwcBalance, setGwcBalance] = useState<string>('0');
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (address && provider && chainId) {
      loadBalances();
    }
  }, [address, provider, chainId]);

  const loadBalances = async () => {
    if (!address || !provider || !chainId) return;
    
    setIsLoadingBalance(true);
    try {
      const balance = await getGWCBalance(provider, address, chainId);
      setGwcBalance(balance);

      // Fetch pending rewards from backend
      const response = await fetch(`http://127.0.0.1:3000/api/rewards/${address}`);
      if (response.ok) {
        const data = await response.json();
        // Sum up pending rewards
        const total = data.pendingRewards?.reduce((sum: number, r: any) => {
          return sum + (r.claimed ? 0 : parseFloat(r.amount) / 1e18);
        }, 0) || 0;
        setPendingRewards(total.toString());
      }
    } catch (error) {
      console.error('Failed to load balances:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleClaim = async () => {
    if (!address || !provider || !chainId) {
      alert('Please connect your wallet first');
      return;
    }

    setIsClaiming(true);
    try {
      // TODO: Fetch proof from backend and execute claim transaction
      alert('Claim functionality coming soon! Need to:\n1. Deploy contracts\n2. Get Merkle proof from backend\n3. Execute claim transaction');
    } catch (error: any) {
      console.error('Claim failed:', error);
      alert(`Claim failed: ${error.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
          <h3>GWC Balance</h3>
          <p style={{ fontSize: '2rem', color: '#4ade80' }}>
            {isLoadingBalance ? '...' : parseFloat(gwcBalance).toFixed(4)} GWC
          </p>
          {address && (
            <button
              onClick={loadBalances}
              style={{
                marginTop: '0.5rem',
                padding: '0.25rem 0.75rem',
                background: '#2a3f5f',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '0.875rem'
              }}
            >
              Refresh
            </button>
          )}
        </div>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
          <h3>Pending Rewards</h3>
          <p style={{ fontSize: '1.5rem', color: '#fbbf24' }}>
            {parseFloat(pendingRewards).toFixed(4)} GWC
          </p>
          <button
            onClick={handleClaim}
            disabled={isClaiming || parseFloat(pendingRewards) === 0}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: isClaiming || parseFloat(pendingRewards) === 0 ? '#6b7280' : '#4ade80',
              border: 'none',
              borderRadius: '4px',
              cursor: isClaiming || parseFloat(pendingRewards) === 0 ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            {isClaiming ? 'Claiming...' : 'Claim Rewards'}
          </button>
        </div>
        <div style={{ padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
          <h3>Recent Activity</h3>
          <p style={{ color: '#94a3b8' }}>
            {address ? 'No recent transactions' : 'Connect wallet to view activity'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
