import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface FAHConfig {
  userName: string;
  teamNumber: number;
  passkey?: string;
  power: 'light' | 'medium' | 'full';
  gpuEnabled: boolean;
}

export interface WorkUnitProgress {
  id: string;
  project: number;
  run: number;
  clone: number;
  gen: number;
  progress: number;
  eta: string;
  credit: number;
}

let fahProcess: ChildProcess | null = null;
let currentWorkUnit: WorkUnitProgress | null = null;
let logCallback: ((message: string) => void) | null = null;

export function setLogCallback(callback: (message: string) => void) {
  logCallback = callback;
}

export function getFAHClientPath(): string {
  // Check if FAH is already installed
  const possiblePaths = [
    path.join(app.getPath('userData'), 'fah', 'FAHClient.exe'),
    'C:\\Program Files (x86)\\FAHClient\\FAHClient.exe',
    'C:\\Program Files\\FAHClient\\FAHClient.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Return userData path (will need to download)
  return path.join(app.getPath('userData'), 'fah', 'FAHClient.exe');
}

export function isFAHInstalled(): boolean {
  const fahPath = getFAHClientPath();
  return fs.existsSync(fahPath);
}

export async function downloadFAHClient(): Promise<boolean> {
  // TODO: Download from https://download.foldingathome.org/releases/public/release/fahclient/windows/fahclient_7.6.21_x86.exe
  // For now, return false and instruct user to download manually
  return false;
}

export function startFAHClient(config: FAHConfig): boolean {
  if (fahProcess) {
    return false; // Already running
  }

  const fahPath = getFAHClientPath();
  if (!fs.existsSync(fahPath)) {
    throw new Error('FAH client not found. Please install Folding@Home first.');
  }

  const args = [
    '--user', config.userName,
    '--team', config.teamNumber.toString(),
    '--power', config.power,
  ];

  if (config.passkey) {
    args.push('--passkey', config.passkey);
  }

  if (config.gpuEnabled) {
    args.push('--gpu', 'true');
  }

  args.push('--smp', 'true'); // Enable CPU folding

  fahProcess = spawn(fahPath, args, {
    cwd: path.dirname(fahPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  fahProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    parseLogOutput(output);
    if (logCallback) {
      logCallback(output);
    }
  });

  fahProcess.stderr?.on('data', (data) => {
    console.error(`[FAH Error] ${data}`);
  });

  fahProcess.on('exit', (code) => {
    console.log(`FAH client exited with code ${code}`);
    fahProcess = null;
    currentWorkUnit = null;
  });

  return true;
}

export function stopFAHClient(): boolean {
  if (!fahProcess) {
    return false;
  }

  fahProcess.kill('SIGTERM');
  fahProcess = null;
  currentWorkUnit = null;
  return true;
}

export function pauseFAHClient(): boolean {
  if (!fahProcess) {
    return false;
  }

  // Send SIGUSR1 to pause (if supported)
  try {
    fahProcess.kill('SIGUSR1');
    return true;
  } catch (error) {
    return false;
  }
}

export function getFAHStatus(): { 
  running: boolean; 
  currentWU: WorkUnitProgress | null;
} {
  return {
    running: fahProcess !== null && !fahProcess.killed,
    currentWU: currentWorkUnit,
  };
}

function parseLogOutput(output: string) {
  // Parse work unit assignment
  const wuAssignmentRegex = /WU(\d+):p(\d+):Assigned to (\d+):(\d+):(\d+)/;
  const wuMatch = output.match(wuAssignmentRegex);
  if (wuMatch) {
    currentWorkUnit = {
      id: wuMatch[1],
      project: parseInt(wuMatch[2]),
      run: parseInt(wuMatch[3]),
      clone: parseInt(wuMatch[4]),
      gen: parseInt(wuMatch[5]),
      progress: 0,
      eta: 'calculating...',
      credit: 0,
    };
  }

  // Parse progress
  const progressRegex = /Completed (\d+) out of \d+ steps \((\d+)%\)/;
  const progressMatch = output.match(progressRegex);
  if (progressMatch && currentWorkUnit) {
    currentWorkUnit.progress = parseInt(progressMatch[2]);
  }

  // Parse ETA
  const etaRegex = /ETA: ([0-9:]+)/;
  const etaMatch = output.match(etaRegex);
  if (etaMatch && currentWorkUnit) {
    currentWorkUnit.eta = etaMatch[1];
  }

  // Parse credit estimate
  const creditRegex = /Final credit estimate: ([\d.]+)/;
  const creditMatch = output.match(creditRegex);
  if (creditMatch && currentWorkUnit) {
    currentWorkUnit.credit = parseFloat(creditMatch[1]);
  }

  // Parse completion
  if (output.includes('Final credit estimate') && currentWorkUnit) {
    // Work unit completed - notify main process
    notifyWorkUnitComplete(currentWorkUnit);
  }
}

function notifyWorkUnitComplete(wu: WorkUnitProgress) {
  // Send IPC notification to renderer
  console.log(`[FAH] Work unit ${wu.id} completed! Credit: ${wu.credit}`);
  // This will be handled by IPC in main.ts
}

export function getCurrentWorkUnit(): WorkUnitProgress | null {
  return currentWorkUnit;
}
