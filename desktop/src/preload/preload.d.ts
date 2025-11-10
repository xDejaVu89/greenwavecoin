export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getComputeStatus: () => Promise<{
    running: boolean;
    paused?: boolean;
    workUnits?: number;
    pointsEarned?: number;
    currentProject?: number;
    currentProgress?: number;
    lastTask: any;
  }>;
  checkFAHInstalled: () => Promise<boolean>;
  startComputeWorker: (config?: {
    userName?: string;
    teamNumber?: number;
    passkey?: string;
    power?: 'light' | 'medium' | 'full';
    gpuEnabled?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  stopComputeWorker: () => Promise<{ success: boolean; error?: string }>;
  pauseComputeWorker: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
