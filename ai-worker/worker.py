#!/usr/bin/env python3
"""
GreenWaveCoin AI Algorithm Worker
==================================
Distributed AI algorithm research node for the GreenWaveCoin network.
Replaces the Folding@Home integration with a local Neural Architecture Search (NAS)
compute task. Each work unit tests a small neural network configuration on a
benchmark dataset and reports accuracy + training time back to the coordinator.

Usage:
    python3 worker.py --backend http://localhost:3000 --wallet 0xYourWalletAddress

Environment variables (override CLI flags):
    BACKEND_BASE_URL    Backend coordinator URL
    WORKER_WALLET       Ethereum wallet address for reward payouts
    POLL_INTERVAL       Seconds between task polls (default: 30)
    LOG_LEVEL           DEBUG | INFO | WARNING (default: INFO)
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import time
import traceback
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Optional: torch import (graceful fallback to numpy-only mode)
# ---------------------------------------------------------------------------
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

import numpy as np

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("gwc-worker")


# ---------------------------------------------------------------------------
# Benchmark dataset (synthetic, reproducible, no download required)
# ---------------------------------------------------------------------------

def generate_benchmark_dataset(n_samples: int = 1000, n_features: int = 20,
                                n_classes: int = 4, seed: int = 42):
    """
    Generate a reproducible synthetic classification dataset.
    Using a fixed seed ensures every worker evaluates the same problem.
    """
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features).astype(np.float32)
    # Create non-linear class boundaries
    weights = rng.randn(n_features, n_classes).astype(np.float32)
    logits = X @ weights + rng.randn(n_samples, n_classes).astype(np.float32) * 0.5
    y = np.argmax(logits, axis=1).astype(np.int64)
    # Split 80/20 train/test
    split = int(0.8 * n_samples)
    return (X[:split], y[:split]), (X[split:], y[split:])


# ---------------------------------------------------------------------------
# Neural network builder from task config
# ---------------------------------------------------------------------------

def build_model(config: dict) -> "nn.Module":
    """
    Build a PyTorch model from a JSON config dict.
    Config schema:
        {
          "layers": [64, 32],          # hidden layer sizes
          "activation": "relu",        # relu | tanh | sigmoid | leaky_relu
          "dropout": 0.2,              # dropout rate (0 = disabled)
          "input_size": 20,
          "output_size": 4
        }
    """
    layers_sizes = config.get("layers", [64, 32])
    activation_name = config.get("activation", "relu")
    dropout_rate = float(config.get("dropout", 0.0))
    input_size = int(config.get("input_size", 20))
    output_size = int(config.get("output_size", 4))

    activation_map = {
        "relu": nn.ReLU(),
        "tanh": nn.Tanh(),
        "sigmoid": nn.Sigmoid(),
        "leaky_relu": nn.LeakyReLU(0.1),
        "elu": nn.ELU(),
    }
    activation = activation_map.get(activation_name, nn.ReLU())

    layers = []
    prev_size = input_size
    for size in layers_sizes:
        layers.append(nn.Linear(prev_size, size))
        layers.append(activation_map.get(activation_name, nn.ReLU()))
        if dropout_rate > 0:
            layers.append(nn.Dropout(dropout_rate))
        prev_size = size
    layers.append(nn.Linear(prev_size, output_size))

    return nn.Sequential(*layers)


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

def train_and_evaluate(config: dict) -> dict:
    """
    Train a model defined by `config` on the benchmark dataset.
    Returns a result dict with accuracy, loss, and timing info.
    """
    if not TORCH_AVAILABLE:
        raise RuntimeError("PyTorch is not installed. Run: pip3 install torch")

    epochs = int(config.get("epochs", 10))
    lr = float(config.get("learning_rate", 0.001))
    batch_size = int(config.get("batch_size", 64))
    seed = int(config.get("dataset_seed", 42))

    # Reproducible training
    torch.manual_seed(seed)
    np.random.seed(seed)

    (X_train, y_train), (X_test, y_test) = generate_benchmark_dataset(seed=seed)

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    test_ds = TensorDataset(torch.from_numpy(X_test), torch.from_numpy(y_test))
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=batch_size)

    model = build_model(config)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    start_time = time.time()

    # Training
    model.train()
    final_loss = 0.0
    for epoch in range(epochs):
        epoch_loss = 0.0
        for X_batch, y_batch in train_loader:
            optimizer.zero_grad()
            output = model(X_batch)
            loss = criterion(output, y_batch)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
        final_loss = epoch_loss / len(train_loader)
        log.debug(f"Epoch {epoch+1}/{epochs} — loss: {final_loss:.4f}")

    elapsed = time.time() - start_time

    # Evaluation
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            output = model(X_batch)
            predicted = torch.argmax(output, dim=1)
            correct += (predicted == y_batch).sum().item()
            total += y_batch.size(0)

    accuracy = correct / total if total > 0 else 0.0
    param_count = sum(p.numel() for p in model.parameters())

    return {
        "accuracy": round(accuracy, 6),
        "final_loss": round(final_loss, 6),
        "training_time_seconds": round(elapsed, 3),
        "param_count": param_count,
        "epochs_completed": epochs,
    }


# ---------------------------------------------------------------------------
# Numpy-only fallback (no PyTorch) — simple logistic regression
# ---------------------------------------------------------------------------

def numpy_fallback_evaluate(config: dict) -> dict:
    """
    Simple numpy-based evaluation for environments without PyTorch.
    Uses a basic perceptron / logistic regression as a proxy.
    """
    seed = int(config.get("dataset_seed", 42))
    (X_train, y_train), (X_test, y_test) = generate_benchmark_dataset(seed=seed)

    rng = np.random.RandomState(seed)
    n_classes = 4
    W = rng.randn(X_train.shape[1], n_classes).astype(np.float32) * 0.01
    b = np.zeros(n_classes, dtype=np.float32)
    lr = float(config.get("learning_rate", 0.01))
    epochs = int(config.get("epochs", 10))

    start = time.time()
    for _ in range(epochs):
        logits = X_train @ W + b
        exp_l = np.exp(logits - logits.max(axis=1, keepdims=True))
        probs = exp_l / exp_l.sum(axis=1, keepdims=True)
        one_hot = np.eye(n_classes)[y_train]
        grad_logits = (probs - one_hot) / len(y_train)
        W -= lr * (X_train.T @ grad_logits)
        b -= lr * grad_logits.sum(axis=0)

    elapsed = time.time() - start
    test_logits = X_test @ W + b
    predicted = np.argmax(test_logits, axis=1)
    accuracy = (predicted == y_test).mean()

    return {
        "accuracy": round(float(accuracy), 6),
        "final_loss": -1.0,
        "training_time_seconds": round(elapsed, 3),
        "param_count": int(W.size + b.size),
        "epochs_completed": epochs,
        "mode": "numpy_fallback",
    }


# ---------------------------------------------------------------------------
# Result fingerprinting (anti-cheat proof-of-work)
# ---------------------------------------------------------------------------

def compute_result_hash(task_id: str, config: dict, metrics: dict) -> str:
    """
    Produce a deterministic SHA-256 fingerprint of the task result.
    This allows the server to spot-check results by re-running the same task
    and comparing hashes. The hash binds the task_id to the exact metrics.
    """
    canonical = json.dumps({
        "task_id": task_id,
        "config": config,
        "accuracy": metrics["accuracy"],
        "final_loss": metrics["final_loss"],
        "param_count": metrics["param_count"],
    }, sort_keys=True)
    return "0x" + hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Backend API client
# ---------------------------------------------------------------------------

class BackendClient:
    def __init__(self, base_url: str, wallet: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.wallet = wallet
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "GreenWaveCoin-AI-Worker/1.0",
        })

    def health_check(self) -> bool:
        try:
            r = self.session.get(f"{self.base_url}/health", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def fetch_task(self) -> Optional[dict]:
        try:
            r = self.session.get(
                f"{self.base_url}/api/tasks",
                params={"worker": self.wallet},
                timeout=self.timeout,
            )
            if r.status_code == 204:
                return None  # No tasks available
            r.raise_for_status()
            data = r.json()
            return data.get("task")
        except requests.exceptions.RequestException as e:
            log.warning(f"Failed to fetch task: {e}")
            return None

    def submit_result(self, task_id: str, config: dict, metrics: dict) -> bool:
        result_hash = compute_result_hash(task_id, config, metrics)
        payload = {
            "id": task_id,
            "worker": self.wallet,
            "hash": result_hash,
            "metrics": metrics,
            "config": config,
            # signature field kept for compatibility with existing results route
            "signature": "0x" + "0" * 130,  # placeholder; server verifies hash
        }
        try:
            r = self.session.post(
                f"{self.base_url}/api/results",
                json=payload,
                timeout=self.timeout,
            )
            r.raise_for_status()
            resp = r.json()
            log.info(f"Result submitted — accepted={resp.get('accepted')}, "
                     f"valid={resp.get('validSignature')}, "
                     f"accuracy={metrics['accuracy']:.4f}, "
                     f"time={metrics['training_time_seconds']:.1f}s")
            return True
        except requests.exceptions.RequestException as e:
            log.error(f"Failed to submit result: {e}")
            return False


# ---------------------------------------------------------------------------
# Main worker loop
# ---------------------------------------------------------------------------

def run_worker(backend_url: str, wallet: str, poll_interval: int):
    client = BackendClient(backend_url, wallet)

    log.info(f"GreenWaveCoin AI Worker starting")
    log.info(f"Backend: {backend_url}")
    log.info(f"Wallet:  {wallet}")
    log.info(f"PyTorch: {'available' if TORCH_AVAILABLE else 'NOT available (numpy fallback)'}")
    log.info(f"Poll interval: {poll_interval}s")

    # Wait for backend to be reachable
    while not client.health_check():
        log.warning("Backend not reachable, retrying in 10s...")
        time.sleep(10)
    log.info("Backend connection established.")

    while True:
        try:
            task = client.fetch_task()
            if task is None:
                log.info("No tasks available, waiting...")
                time.sleep(poll_interval)
                continue

            task_id = task["id"]
            raw_payload = task.get("payload", "{}")
            try:
                config = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
            except json.JSONDecodeError:
                log.warning(f"Invalid JSON payload for task {task_id}, skipping.")
                time.sleep(5)
                continue

            log.info(f"Processing task {task_id} — config: {json.dumps(config)}")

            if TORCH_AVAILABLE:
                metrics = train_and_evaluate(config)
            else:
                metrics = numpy_fallback_evaluate(config)

            client.submit_result(task_id, config, metrics)

        except KeyboardInterrupt:
            log.info("Worker stopped by user.")
            sys.exit(0)
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            log.debug(traceback.format_exc())
            time.sleep(poll_interval)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="GreenWaveCoin AI Algorithm Worker"
    )
    parser.add_argument(
        "--backend",
        default=os.environ.get("BACKEND_BASE_URL", "http://localhost:3000"),
        help="Backend coordinator base URL",
    )
    parser.add_argument(
        "--wallet",
        default=os.environ.get("WORKER_WALLET", ""),
        required=not os.environ.get("WORKER_WALLET"),
        help="Ethereum wallet address for reward payouts",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=int(os.environ.get("POLL_INTERVAL", "30")),
        help="Seconds between task polls when queue is empty",
    )
    args = parser.parse_args()

    if not args.wallet.startswith("0x") or len(args.wallet) != 42:
        log.error("Invalid wallet address. Must be a 42-character 0x-prefixed Ethereum address.")
        sys.exit(1)

    run_worker(args.backend, args.wallet, args.poll_interval)


if __name__ == "__main__":
    main()
