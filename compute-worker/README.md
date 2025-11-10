# GreenWaveCoin Compute Worker

Rust-based worker that polls the backend for compute tasks, performs deterministic hashing, signs results, and submits them.

## Flow
1. GET /api/tasks -> receive next task `{ id, payload }`.
2. Hash payload bytes with blake3 -> `0x` hex.
3. Sign raw 32-byte hash with the worker private key.
4. POST /api/results with `{ id, worker, hash, signature }`.
5. Sleep and repeat.

## Configuration (.env)
- BACKEND_URL: Base URL to backend (e.g. http://127.0.0.1:3000)
- WORKER_PRIVATE_KEY: Hex private key for signing
- POLL_INTERVAL_MS: Polling interval in milliseconds

## Run
```powershell
# Copy env template
Copy-Item .env.example .env
# Edit .env to insert private key
# Build & run
cargo run --release
```

## Security Notes
- Private key should be dedicated to compute ops; do not reuse a wallet holding significant funds.
- Consider future rotation & ephemeral session keys.
- Signature covers only hash; backend can later require inclusion of task id in signed message for stronger binding.
