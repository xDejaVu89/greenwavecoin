import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  getComputeStatus: () => ipcRenderer.invoke('get-compute-status'),
  
  checkFAHInstalled: () => ipcRenderer.invoke('check-fah-installed'),
  
  startComputeWorker: (config?: {
    userName?: string;
    teamNumber?: number;
    passkey?: string;
    power?: 'light' | 'medium' | 'full';
    gpuEnabled?: boolean;
  }) => ipcRenderer.invoke('start-compute-worker', config),
  
  stopComputeWorker: () => ipcRenderer.invoke('stop-compute-worker'),
  
  pauseComputeWorker: () => ipcRenderer.invoke('pause-compute-worker'),
});
