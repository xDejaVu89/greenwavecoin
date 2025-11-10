import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
  startFAHClient,
  stopFAHClient,
  pauseFAHClient,
  getFAHStatus,
  isFAHInstalled,
  FAHConfig,
  getCurrentWorkUnit,
} from './fah';

let mainWindow: BrowserWindow | null = null;
let workerProcess: ChildProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill worker before quitting
  if (workerProcess) {
    workerProcess.kill();
    workerProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (workerProcess) {
    workerProcess.kill();
    workerProcess = null;
  }
  stopFAHClient();
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-compute-status', async () => {
  const fahStatus = getFAHStatus();
  const workUnit = getCurrentWorkUnit();
  
  return {
    running: fahStatus.running,
    paused: false,
    workUnits: workUnit ? 1 : 0,
    pointsEarned: workUnit?.credit || 0,
    currentProject: workUnit?.project,
    currentProgress: workUnit?.progress,
    lastTask: null // For backward compatibility
  };
});

ipcMain.handle('check-fah-installed', async () => {
  return isFAHInstalled();
});

ipcMain.handle('start-compute-worker', async (_event, config?: FAHConfig) => {
  try {
    const defaultConfig: FAHConfig = {
      userName: 'GreenWaveCoinUser',
      teamNumber: 0,
      power: 'medium',
      gpuEnabled: true,
      ...config
    };
    
    const result = startFAHClient(defaultConfig);
    return { success: result, error: result ? undefined : 'Failed to start FAH client' };
  } catch (err: any) {
    console.error('Failed to start FAH client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pause-compute-worker', async () => {
  try {
    const result = pauseFAHClient();
    return { success: result, error: result ? undefined : 'Failed to pause FAH client' };
  } catch (err: any) {
    console.error('Failed to pause FAH client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-compute-worker', async () => {
  try {
    const result = stopFAHClient();
    return { success: result, error: result ? undefined : 'No FAH client running' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
