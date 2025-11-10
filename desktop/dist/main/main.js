"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
let mainWindow = null;
let workerProcess = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    // Kill worker before quitting
    if (workerProcess) {
        workerProcess.kill();
        workerProcess = null;
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('quit', () => {
    if (workerProcess) {
        workerProcess.kill();
        workerProcess = null;
    }
});
// IPC handlers
electron_1.ipcMain.handle('get-app-version', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('get-compute-status', async () => {
    return {
        running: workerProcess !== null && !workerProcess.killed,
        lastTask: null // TODO: track via IPC or worker logs
    };
});
electron_1.ipcMain.handle('start-compute-worker', async () => {
    if (workerProcess) {
        return { success: false, error: 'Worker already running' };
    }
    try {
        // Path to compiled Rust worker binary
        // In dev: assume cargo build in compute-worker/ directory
        // In prod: bundle with app resources
        const workerPath = path_1.default.join(electron_1.app.getAppPath(), '../compute-worker/target/release/compute-worker.exe');
        workerProcess = (0, child_process_1.spawn)(workerPath, [], {
            cwd: path_1.default.join(electron_1.app.getAppPath(), '../compute-worker'),
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        workerProcess.stdout?.on('data', (data) => {
            console.log(`[Worker] ${data}`);
        });
        workerProcess.stderr?.on('data', (data) => {
            console.error(`[Worker Error] ${data}`);
        });
        workerProcess.on('exit', (code) => {
            console.log(`Worker exited with code ${code}`);
            workerProcess = null;
        });
        return { success: true };
    }
    catch (err) {
        console.error('Failed to start worker:', err);
        return { success: false, error: err.message };
    }
});
electron_1.ipcMain.handle('stop-compute-worker', async () => {
    if (!workerProcess) {
        return { success: false, error: 'No worker running' };
    }
    try {
        workerProcess.kill('SIGTERM');
        workerProcess = null;
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
