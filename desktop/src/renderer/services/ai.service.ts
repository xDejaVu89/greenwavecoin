/**
 * GreenWaveCoin AI Research Network — Backend API Service
 * Replaces the FAH backend service with AI-specific endpoints.
 */

const BACKEND_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetworkStats {
  status: string;
  totalTasksCompleted: number;
  totalInvalidSubmissions: number;
  uniqueWorkers: number;
  averageAccuracy: number;
  bestAccuracyEver: number;
  totalComputeSeconds: number;
  networkStatus: string;
}

export interface LeaderboardEntry {
  wallet: string;
  tasksCompleted: number;
  averageAccuracy: number;
  totalTrainingTimeSeconds: number;
  invalidSubmissions: number;
  estimatedGwcReward: number;
}

export interface BestConfig {
  accuracy: number;
  config: {
    layers: number[];
    activation: string;
    dropout: number;
    learning_rate: number;
    batch_size: number;
    epochs: number;
  };
  taskId: string;
  worker: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  network: string;
  queueLength: number;
  totalResults: number;
  validResults: number;
  uniqueWorkers: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function pingHealth(timeoutMs = 600): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

class AIService {
  /** Full health check with queue stats */
  async getHealth(): Promise<HealthResponse | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      return await res.json();
    } catch {
      return null;
    }
  }

  /** Network-wide aggregate statistics */
  async getNetworkStats(): Promise<NetworkStats | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/stats`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /** Top workers ranked by tasks completed */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/leaderboard`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }

  /** Top-performing neural network configurations discovered */
  async getBestConfigs(): Promise<BestConfig[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/best-configs`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.bestConfigs || [];
    } catch {
      return [];
    }
  }

  /** Get a worker's personal stats from the leaderboard */
  async getWorkerStats(wallet: string): Promise<LeaderboardEntry | null> {
    const leaderboard = await this.getLeaderboard();
    return leaderboard.find(
      e => e.wallet.toLowerCase() === wallet.toLowerCase()
    ) || null;
  }
}

export const aiService = new AIService();
