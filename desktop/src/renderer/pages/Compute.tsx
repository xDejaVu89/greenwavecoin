import { useState, useEffect, useCallback } from 'react';
import { aiService, NetworkStats, LeaderboardEntry, BestConfig } from '../services/ai.service';

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(0,200,100,0.08)',
      border: '1px solid rgba(0,200,100,0.25)',
      borderRadius: 12,
      padding: '16px 20px',
      minWidth: 140,
      flex: '1 1 140px',
    }}>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#00c864', fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: online ? '#00c864' : '#e05',
      marginRight: 6,
      boxShadow: online ? '0 0 6px #00c864' : 'none',
    }} />
  );
}

// ---------------------------------------------------------------------------
// Main Compute page
// ---------------------------------------------------------------------------

export default function Compute() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [bestConfigs, setBestConfigs] = useState<BestConfig[]>([]);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'configs'>('overview');

  const refresh = useCallback(async () => {
    const health = await aiService.getHealth();
    setBackendOnline(!!health && health.status === 'ok');
    if (health) setQueueLength(health.queueLength || 0);

    const [networkStats, lb, configs] = await Promise.all([
      aiService.getNetworkStats(),
      aiService.getLeaderboard(),
      aiService.getBestConfigs(),
    ]);
    if (networkStats) setStats(networkStats);
    setLeaderboard(lb);
    setBestConfigs(configs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const formatSeconds = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  const truncateWallet = (w: string) =>
    w.length > 12 ? `${w.slice(0, 6)}\u2026${w.slice(-4)}` : w;

  return (
    <div style={{ padding: '24px 28px', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#fff' }}>
            AI Research Network
          </h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            Distributed Neural Architecture Search — earn GWC by contributing compute
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            <StatusDot online={backendOnline} />
            {backendOnline ? 'Coordinator online' : 'Coordinator offline'}
          </span>
          <button
            onClick={refresh}
            style={{
              background: 'rgba(0,200,100,0.15)',
              border: '1px solid rgba(0,200,100,0.3)',
              color: '#00c864',
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* How it works banner */}
      <div style={{
        background: 'rgba(0,200,100,0.05)',
        border: '1px solid rgba(0,200,100,0.15)',
        borderRadius: 12,
        padding: '14px 20px',
        marginBottom: 24,
        fontSize: 13,
        color: '#aaa',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: '#00c864' }}>How it works:</strong> Your computer runs small
        neural network experiments and reports results back to the coordinator. Each valid
        experiment earns <strong style={{ color: '#fff' }}>GWC tokens</strong>. The best
        configurations discovered are used to improve future AI efficiency.
        <br />
        <span style={{ color: '#666', fontSize: 12 }}>
          Start the worker:{' '}
          <code style={{ color: '#00c864' }}>
            python3 ai-worker/worker.py --wallet 0xYourAddress
          </code>
        </span>
      </div>

      {/* Stats row */}
      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Loading network stats...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="Tasks Completed" value={stats?.totalTasksCompleted ?? 0} sub="valid results" />
          <StatCard label="Active Workers" value={stats?.uniqueWorkers ?? 0} sub="unique wallets" />
          <StatCard
            label="Best Accuracy"
            value={stats ? `${(stats.bestAccuracyEver * 100).toFixed(1)}%` : '—'}
            sub="on benchmark"
          />
          <StatCard
            label="Avg Accuracy"
            value={stats ? `${(stats.averageAccuracy * 100).toFixed(1)}%` : '—'}
            sub="network average"
          />
          <StatCard label="Queue Length" value={queueLength} sub="tasks pending" />
          <StatCard
            label="Total Compute"
            value={stats ? formatSeconds(stats.totalComputeSeconds) : '—'}
            sub="contributed"
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #222' }}>
        {(['overview', 'leaderboard', 'configs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'rgba(0,200,100,0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #00c864' : '2px solid transparent',
              color: activeTab === tab ? '#00c864' : '#888',
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'overview' ? 'Overview' : tab === 'leaderboard' ? 'Leaderboard' : 'Best Configs'}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[
            {
              title: 'Neural Architecture Search',
              desc: 'Each task tests a different neural network design — varying layer sizes, activation functions, dropout rates, and learning rates on a standard benchmark dataset.',
              icon: '🧠',
            },
            {
              title: 'Evolutionary Optimization',
              desc: 'The best-performing architectures are selected, mutated, and crossed to produce the next generation — gradually converging on more efficient AI designs.',
              icon: '🧬',
            },
            {
              title: 'Anti-Cheat Verification',
              desc: 'Each result includes a cryptographic hash binding the task ID to the exact metrics. The server spot-checks results to prevent fabricated submissions.',
              icon: '🔒',
            },
            {
              title: 'GWC Rewards',
              desc: 'Workers earn GWC proportional to tasks completed and accuracy achieved. Higher-quality results earn more. Rewards are claimable via the smart contract.',
              icon: '💰',
            },
          ].map(card => (
            <div key={card.title} style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>{card.title}</div>
              <div style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div>
          {leaderboard.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>
              No results yet. Start a worker to appear on the leaderboard.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#666', borderBottom: '1px solid #222' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Rank</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Wallet</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Tasks</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Avg Accuracy</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Compute Time</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Est. GWC</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.wallet} style={{
                    borderBottom: '1px solid #1a1a1a',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}>
                    <td style={{ padding: '10px 12px', color: i < 3 ? '#00c864' : '#666' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#ccc' }}>
                      {truncateWallet(entry.wallet)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff' }}>
                      {entry.tasksCompleted}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#00c864' }}>
                      {(entry.averageAccuracy * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#888' }}>
                      {formatSeconds(entry.totalTrainingTimeSeconds)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                      {entry.estimatedGwcReward.toFixed(2)} GWC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Best Configs */}
      {activeTab === 'configs' && (
        <div>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
            Top neural network architectures discovered by the network, ranked by accuracy on the benchmark dataset.
          </p>
          {bestConfigs.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>
              No configurations evaluated yet. Workers need to complete tasks first.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {bestConfigs.slice(0, 12).map((item, i) => (
                <div key={item.taskId} style={{
                  background: '#1a1a1a',
                  border: `1px solid ${i === 0 ? 'rgba(0,200,100,0.4)' : '#2a2a2a'}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: '#666', fontSize: 12 }}>#{i + 1}</span>
                    <span style={{ color: '#00c864', fontWeight: 700, fontSize: 16 }}>
                      {(item.accuracy * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
                    <div><span style={{ color: '#ccc' }}>Layers:</span> [{item.config.layers?.join(', ')}]</div>
                    <div><span style={{ color: '#ccc' }}>Activation:</span> {item.config.activation}</div>
                    <div><span style={{ color: '#ccc' }}>Dropout:</span> {item.config.dropout}</div>
                    <div><span style={{ color: '#ccc' }}>LR:</span> {item.config.learning_rate}</div>
                    <div>
                      <span style={{ color: '#ccc' }}>Batch:</span> {item.config.batch_size}&nbsp;
                      <span style={{ color: '#ccc' }}>Epochs:</span> {item.config.epochs}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#444', fontFamily: 'monospace' }}>
                    by {truncateWallet(item.worker)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
