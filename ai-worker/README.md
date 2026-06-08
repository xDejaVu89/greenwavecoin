# GreenWaveCoin AI Worker

The AI Worker is the distributed compute node for the GreenWaveCoin network. Instead of folding proteins (Folding@Home), participants contribute CPU/GPU time to **Neural Architecture Search (NAS)** — systematically testing neural network configurations to discover more efficient AI algorithms.

## How It Works

1. The **task generator** seeds the backend with algorithm configurations to test.
2. Each **worker node** fetches a task, trains a small neural network on a benchmark dataset, and reports accuracy + training time back to the coordinator.
3. The **evolution engine** (inside the task generator) selects the best-performing configurations, mutates and crosses them, and seeds the next generation — gradually converging on better architectures.
4. Workers are rewarded in **GreenWaveCoin (GWC)** proportional to the compute they contribute.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Backend Coordinator                    │
│  POST /api/tasks/create  ←── task_generator.py          │
│  GET  /api/tasks         ──► worker.py (fetch task)     │
│  POST /api/results       ◄── worker.py (submit result)  │
│  GET  /api/ai/leaderboard──► Dashboard / Electron app   │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
pip3 install -r requirements.txt
```

> PyTorch is optional. If not installed, the worker falls back to a numpy-based logistic regression. For meaningful NAS results, PyTorch is strongly recommended.

### 2. Seed initial tasks (run once on the server)

```bash
python3 task_generator.py --backend http://your-backend:3000 --count 50
```

### 3. Start a worker node

```bash
python3 worker.py \
  --backend http://your-backend:3000 \
  --wallet 0xYourEthereumWalletAddress
```

### 4. Run the evolution engine (optional, server-side)

```bash
python3 task_generator.py \
  --backend http://your-backend:3000 \
  --evolve \
  --gen-size 20 \
  --gen-interval 300
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BACKEND_BASE_URL` | Backend coordinator URL | `http://localhost:3000` |
| `WORKER_WALLET` | Ethereum wallet address | *(required)* |
| `POLL_INTERVAL` | Seconds between task polls | `30` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING` | `INFO` |

## Task Config Schema

Each task payload is a JSON object:

```json
{
  "layers": [64, 32],
  "activation": "relu",
  "dropout": 0.2,
  "learning_rate": 0.001,
  "batch_size": 64,
  "epochs": 10,
  "input_size": 20,
  "output_size": 4,
  "dataset_seed": 42
}
```

## Anti-Cheat

Each result includes a **SHA-256 fingerprint** that binds the task ID, configuration, and reported metrics together. The server can spot-check any result by re-running the same task and comparing hashes. Workers submitting fabricated results will produce non-matching hashes and be excluded from rewards.

## Reward Model

Rewards are proportional to:
- Number of valid tasks completed
- Accuracy of results (higher accuracy = more useful contribution)
- Training time (longer compute = more effort rewarded)

The exact reward formula is defined in the smart contract and can be adjusted via governance.
