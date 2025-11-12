import { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { getGWCBalance } from '../utils/contracts';
import { FAHRewardsCard } from '../components/FAHRewardsCard';

function Dashboard() {
  const { address, provider, chainId } = useWalletStore();
  const [gwcBalance, setGwcBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

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
    } catch (error) {
      console.error('Failed to load balances:', error);
    } finally {
      setIsLoadingBalance(false);
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
        
        <FAHRewardsCard />
        
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
