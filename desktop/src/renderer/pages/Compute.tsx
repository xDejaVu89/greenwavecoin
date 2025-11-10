import { useState, useEffect } from 'react';

function Compute() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fahInstalled, setFahInstalled] = useState<boolean | null>(null);
  const [config, setConfig] = useState({
    userName: 'GreenWaveCoinUser',
    teamNumber: 0,
    passkey: '',
    power: 'medium' as 'light' | 'medium' | 'full',
    gpuEnabled: true,
  });

  useEffect(() => {
    checkStatus();
    checkFAHInstalled();
    const interval = setInterval(checkStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkFAHInstalled = async () => {
    if (window.electron) {
      const installed = await window.electron.checkFAHInstalled();
      setFahInstalled(installed);
    }
  };

  const checkStatus = async () => {
    if (window.electron) {
      const result = await window.electron.getComputeStatus();
      setStatus(result);
    }
  };

  const toggleWorker = async () => {
    setIsLoading(true);
    if (window.electron) {
      if (status?.running) {
        await window.electron.stopComputeWorker();
      } else {
        await window.electron.startComputeWorker(config);
      }
      await checkStatus();
    }
    setIsLoading(false);
  };

  const pauseWorker = async () => {
    setIsLoading(true);
    if (window.electron) {
      await window.electron.pauseComputeWorker();
      await checkStatus();
    }
    setIsLoading(false);
  };

  const estimatedRewards = status?.pointsEarned ? (status.pointsEarned / 1000).toFixed(3) : '0.000';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Compute Contribution</h1>
      <p>Contribute to scientific research and earn GWC tokens</p>

      {fahInstalled === false && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          padding: '1rem', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <h3>⚠️ Folding@Home Not Installed</h3>
          <p>Please download and install Folding@Home client:</p>
          <a 
            href="https://foldingathome.org/start-folding/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#0066cc' }}
          >
            Download Folding@Home
          </a>
        </div>
      )}

      <div style={{ 
        background: '#f5f5f5', 
        padding: '1.5rem', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2>Current Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <strong>Status:</strong> 
            <span style={{ 
              marginLeft: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              background: status?.running ? '#4caf50' : '#9e9e9e',
              color: 'white',
              fontSize: '0.9rem'
            }}>
              {status?.running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div>
            <strong>Work Units:</strong> {status?.workUnits || 0}
          </div>
          <div>
            <strong>FAH Points:</strong> {status?.pointsEarned?.toFixed(0) || 0}
          </div>
          <div>
            <strong>Estimated Rewards:</strong> {estimatedRewards} GWC
          </div>
        </div>

        {status?.currentProject && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Current Project</h3>
            <div><strong>Project ID:</strong> {status.currentProject}</div>
            <div>
              <strong>Progress:</strong> {status.currentProgress || 0}%
              <div style={{ 
                width: '100%', 
                height: '20px', 
                background: '#e0e0e0', 
                borderRadius: '10px',
                marginTop: '0.5rem',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${status.currentProgress || 0}%`, 
                  height: '100%', 
                  background: '#4caf50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!status?.running && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: '1.5rem', 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2>Configuration</h2>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Username:</strong>
              </label>
              <input
                type="text"
                value={config.userName}
                onChange={(e) => setConfig({ ...config, userName: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Team Number:</strong>
              </label>
              <input
                type="number"
                value={config.teamNumber}
                onChange={(e) => setConfig({ ...config, teamNumber: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Passkey (optional):</strong>
              </label>
              <input
                type="text"
                value={config.passkey}
                onChange={(e) => setConfig({ ...config, passkey: e.target.value })}
                placeholder="Get from foldingathome.org"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Power Level:</strong>
              </label>
              <select
                value={config.power}
                onChange={(e) => setConfig({ ...config, power: e.target.value as any })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="full">Full</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.gpuEnabled}
                  onChange={(e) => setConfig({ ...config, gpuEnabled: e.target.checked })}
                />
                <strong>Enable GPU Folding</strong>
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={toggleWorker}
          disabled={isLoading || fahInstalled === false}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: 'none',
            background: status?.running ? '#f44336' : '#4caf50',
            color: 'white',
            cursor: isLoading || fahInstalled === false ? 'not-allowed' : 'pointer',
            opacity: isLoading || fahInstalled === false ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Loading...' : status?.running ? 'Stop Folding' : 'Start Folding'}
        </button>

        {status?.running && (
          <button
            onClick={pauseWorker}
            disabled={isLoading}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              borderRadius: '4px',
              border: 'none',
              background: '#ff9800',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Pause
          </button>
        )}
      </div>

      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        background: '#e3f2fd', 
        borderRadius: '8px',
        borderLeft: '4px solid #2196f3'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>💡 About Folding@Home</h3>
        <p style={{ margin: 0 }}>
          Folding@Home uses your computer's spare processing power to run simulations 
          that help researchers find cures for diseases like cancer, Alzheimer's, and COVID-19. 
          By contributing compute power, you earn GWC tokens: <strong>1 GWC per 1,000 FAH points</strong>.
        </p>
      </div>
    </div>
  );
}

export default Compute;
