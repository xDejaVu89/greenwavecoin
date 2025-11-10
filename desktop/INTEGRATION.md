# GreenWaveCoin Desktop - Integration Notes

## Compute Worker Integration

The desktop app now spawns and manages the Rust compute worker as a child process.

### Worker Control Flow

1. **Start Worker**
   - User clicks "Start Worker" in Compute page
   - IPC → main process spawns `compute-worker.exe`
   - Worker polls backend at `BACKEND_URL` (from its .env)
   - Logs streamed to Electron console

2. **Stop Worker**
   - User clicks "Stop Worker" or closes app
   - Main process sends SIGTERM
   - Worker gracefully exits

3. **Status Monitoring**
   - Compute page polls IPC for worker status
   - Shows "Running" / "Idle" based on process state

### Prerequisites

**Rust Worker Must Be Built:**
```powershell
cd ..\compute-worker
cargo build --release
```

This creates `compute-worker\target\release\compute-worker.exe` which the Electron app will spawn.

### Configuration

**Worker (.env in compute-worker/):**
```env
BACKEND_URL=http://127.0.0.1:3000
WORKER_PRIVATE_KEY=0xYOURKEY
POLL_INTERVAL_MS=5000
```

**Desktop (development):**
- Worker path resolved relative to app: `../compute-worker/target/release/compute-worker.exe`
- For production: bundle worker binary into app resources

### Build Everything

Use the provided script:
```powershell
cd desktop
.\build-all.ps1
```

This builds:
1. Rust worker (release mode)
2. Electron main/preload
3. React renderer

### Testing Integration

1. Start backend:
   ```powershell
   cd ..\backend
   npm start
   ```

2. Build worker (if not done):
   ```powershell
   cd ..\compute-worker
   cargo build --release
   ```

3. Launch desktop app:
   ```powershell
   cd ..\desktop
   npm run dev
   ```

4. In app: Navigate to "Compute" page, click "Start Worker"
5. Check Electron dev console for `[Worker]` logs
6. Submit test task via backend API:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/tasks/create" `
     -Body (@{payload=@{test="data"}} | ConvertTo-Json) -ContentType "application/json"
   ```

7. Worker should fetch, hash, sign, and submit result

### Known Limitations

- Worker binary path assumes specific directory structure (not production-ready)
- No worker output streaming to UI yet (console only)
- No task metrics displayed in Compute page (future: WebSocket updates)
- Worker crash/restart not handled (future: watchdog)

### Production TODOs

- [ ] Bundle worker binary with electron-builder (extraResources)
- [ ] Add worker health check / auto-restart
- [ ] Stream worker logs to renderer via IPC events
- [ ] Display live task metrics in Compute page
- [ ] Graceful shutdown timeout (30s then force kill)
- [ ] Worker version mismatch detection
