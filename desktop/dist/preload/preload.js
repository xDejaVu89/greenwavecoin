"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getComputeStatus: () => electron_1.ipcRenderer.invoke('get-compute-status'),
    startComputeWorker: () => electron_1.ipcRenderer.invoke('start-compute-worker'),
    stopComputeWorker: () => electron_1.ipcRenderer.invoke('stop-compute-worker'),
});
