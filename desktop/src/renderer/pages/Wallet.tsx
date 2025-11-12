import { useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { FAHRewardsCard } from '../components/FAHRewardsCard';

function Wallet() {
  const {
    address,
    balance,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork,
  } = useWalletStore();

  useEffect(() => {
    // Auto-connect if already authorized
    if (window.ethereum && window.ethereum.selectedAddress) {
      connect();
    }
  }, [connect]);

  const getNetworkName = (chainId: number | null) => {
    if (!chainId) return 'Unknown';
    const networks: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      80001: 'Mumbai (Testnet)',
    };
    return networks[chainId] || `Chain ${chainId}`;
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div>
      <h2>Wallet</h2>
      
      {error && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#7f1d1d', 
          borderRadius: '8px',
          color: '#fca5a5' 
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        {!address ? (
          <button 
            onClick={connect}
            disabled={isConnecting}
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: isConnecting ? '#6b7280' : '#4ade80', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: isConnecting ? 'wait' : 'pointer', 
              fontSize: '1rem',
              color: '#fff',
              fontWeight: '600'
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button 
                onClick={disconnect}
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: '#ef4444', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  color: '#fff'
                }}
              >
                Disconnect
              </button>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
              <h3>Your Address</h3>
              <p style={{ 
                color: '#94a3b8', 
                marginTop: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '1rem'
              }}>
                {formatAddress(address)}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
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
                Copy Full Address
              </button>
            </div>

            <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
              <h3>Balance</h3>
              <p style={{ 
                fontSize: '2rem', 
                color: '#4ade80',
                marginTop: '0.5rem'
              }}>
                {balance ? parseFloat(balance).toFixed(4) : '0.0000'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                {getNetworkName(chainId)} Native Token
              </p>
            </div>

            <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
              <h3>Network</h3>
              <p style={{ color: '#94a3b8', marginTop: '0.5rem', marginBottom: '1rem' }}>
                Connected to: <strong style={{ color: '#4ade80' }}>{getNetworkName(chainId)}</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => switchNetwork(137)}
                  disabled={chainId === 137}
                  style={{
                    padding: '0.5rem 1rem',
                    background: chainId === 137 ? '#2a3f5f' : '#4ade80',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: chainId === 137 ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    opacity: chainId === 137 ? 0.5 : 1
                  }}
                >
                  Polygon
                </button>
                <button
                  onClick={() => switchNetwork(1)}
                  disabled={chainId === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    background: chainId === 1 ? '#2a3f5f' : '#4ade80',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: chainId === 1 ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    opacity: chainId === 1 ? 0.5 : 1
                  }}
                >
                  Ethereum
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
            {/* Claimable Rewards */}
            <div style={{ marginTop: '1rem' }}>
              <FAHRewardsCard />
            </div>

}

export default Wallet;
