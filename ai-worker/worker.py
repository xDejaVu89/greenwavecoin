#!/usr/bin/env python3
"""
GreenWaveCoin AI Algorithm Worker
==================================
Distributed AI algorithm research node for the GreenWaveCoin network.
Tests neural network configurations on a benchmark dataset and reports
accuracy + training time back to the coordinator in exchange for GWC tokens.

Usage:
    python3 worker.py --backend http://localhost:3000 --wallet 0xYourAddress

Environment variables (override CLI flags):
    BACKEND_BASE_URL    Backend coordinator URL
    WORKER_WALLET       Ethereum wallet address for reward payouts
    WORKER_API_KEY      API key for authenticating with the backend
    POLL_INTERVAL       Seconds between task polls (default: 30)
    LOG_LEVEL           DEBUG | INFO | WARNING (default: INFO)
    MAX_RETRIES         Max submission retries before giving up (default: 3)
"""

import argparse
import hashlib
import json
import logging
import os
import signal
import sys
import time
import traceback
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown = False

def _handle_signal(signum, frame):
    global _shutdown
    log.info("Shutdown signal received, finishing current task then exiting...")
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


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
    weights = rng.randn(n_features, n_classes).astype(np.float32)
    logits = X @ weights + rng.randn(n_samples, n_classes).astype(np.float32) * 0.5
    y = np.argmax(logits, axis=1).astype(np.int64)
    split = int(0.8 * n_samples)
    return (X[:split], y[:split]), (X[split:], y[split:])


# ---------------------------------------------------------------------------
# Neural network builder
# ---------------------------------------------------------------------------

def build_model(config: dict) -> "nn.Module":
    layers_sizes = config.get("layers", [64, 32])
    activation_name = config.get("activation", "relu")
    dropout_rate = float(config.get("dropout", 0.0))
    input_size = int(config.get("input_size", 20))
    output_size = int(config.get("output_size", 4))

    activation_map = {
        "relu": nn.ReLU,
        "tanh": nn.Tanh,
        "sigmoid": nn.Sigmoid,
        "leaky_relu": lambda: nn.LeakyReLU(0.1),
        "elu": nn.ELU,
    }
    act_fn = activation_map.get(activation_name, nn.ReLU)

    layers = []
    prev_size = input_size
    for size in layers_sizes:
        layers.append(nn.Linear(prev_size, size))
        layers.append(act_fn())
        if dropout_rate > 0:
            layers.append(nn.Dropout(dropout_rate))
        prev_size = size
    layers.append(nn.Linear(prev_size, output_size))

    return nn.Sequential(*layers)


# ---------------------------------------------------------------------------
# Training loop (PyTorch)
# ---------------------------------------------------------------------------

def train_and_evaluate(config: dict) -> dict:
    if not TORCH_AVAILABLE:
        raise RuntimeError("PyTorch is not installed. Run: pip3 install torch")

    epochs = int(config.get("epochs", 10))
    lr = float(config.get("learning_rate", 0.001))
    batch_size = int(config.get("batch_size", 64))
    seed = int(config.get("dataset_seed", 42))

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
    final_loss = 0.0

    model.train()
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
        "mode": "pytorch",
    }


# ---------------------------------------------------------------------------
# Numpy-only fallback
# ---------------------------------------------------------------------------

def numpy_fallback_evaluate(config: dict) -> dict:
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
    accuracy = float((predicted == y_test).mean())

    return {
        "accuracy": round(accuracy, 6),
        "final_loss": -1.0,
        "training_time_seconds": round(elapsed, 3),
        "param_count": int(W.size + b.size),
        "epochs_completed": epochs,
        "mode": "numpy_fallback",
    }


# ---------------------------------------------------------------------------
# Result fingerprinting (anti-cheat)
# ---------------------------------------------------------------------------

def compute_result_hash(task_id: str, config: dict, metrics: dict) -> str:
    # Use compact separators (no spaces) to match JavaScript JSON.stringify output.
    # JS: JSON.stringify(obj, keys) produces {"key":value} without spaces.
    # Python default json.dumps produces {"key": value} WITH spaces — causing hash mismatch.
    canonical = json.dumps({
        "task_id": task_id,
        "config": config,
        "accuracy": metrics["accuracy"],
        "final_loss": metrics["final_loss"],
        "param_count": metrics["param_count"],
    }, sort_keys=True, separators=(',', ':'))
    return "0x" + hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Backend API client with retry logic
# ---------------------------------------------------------------------------

class BackendClient:
    def __init__(self, base_url: str, wallet: str, api_key: str = "",
                 timeout: int = 30, max_retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.wallet = wallet
        self.timeout = timeout
        self.max_retries = max_retries

        # Configure session with automatic retry on transient network errors
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "GreenWaveCoin-AI-Worker/1.1",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self.session.headers.update(headers)

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
                timeout=self.timeout,
            )
            if r.status_code == 204:
                return None
            if r.status_code == 401:
                log.error("Authentication failed — check WORKER_API_KEY")
                return None
            r.raise_for_status()
            return r.json().get("task")
        except requests.exceptions.ConnectionError:
            log.warning("Connection error fetching task")
            return None
        except requests.exceptions.Timeout:
            log.warning("Timeout fetching task")
            return None
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
            "signature": "0x" + "0" * 130,  # placeholder; server verifies hash
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                r = self.session.post(
                    f"{self.base_url}/api/results",
                    json=payload,
                    timeout=self.timeout,
                )
                if r.status_code == 401:
                    log.error("Authentication failed submitting result — check WORKER_API_KEY")
                    return False
                r.raise_for_status()
                resp = r.json()
                log.info(
                    f"Result submitted — accepted={resp.get('accepted')}, "
                    f"valid={resp.get('validSignature')}, "
                    f"accuracy={metrics['accuracy']:.4f}, "
                    f"time={metrics['training_time_seconds']:.1f}s"
                )
                return True
            except requests.exceptions.RequestException as e:
                wait = 2 ** attempt
                log.warning(f"Submit attempt {attempt}/{self.max_retries} failed: {e}. "
                            f"Retrying in {wait}s...")
                time.sleep(wait)

        log.error(f"Failed to submit result for task {task_id} after {self.max_retries} attempts")
        return False


# ---------------------------------------------------------------------------
# Main worker loop
# ---------------------------------------------------------------------------

def run_worker(backend_url: str, wallet: str, api_key: str,
               poll_interval: int, max_retries: int):
    global _shutdown

    client = BackendClient(backend_url, wallet, api_key=api_key, max_retries=max_retries)

    log.info("=" * 60)
    log.info("GreenWaveCoin AI Worker v1.1")
    log.info(f"  Backend  : {backend_url}")
    log.info(f"  Wallet   : {wallet}")
    log.info(f"  Auth     : {'enabled' if api_key else 'disabled'}")
    log.info(f"  PyTorch  : {'available' if TORCH_AVAILABLE else 'NOT available (numpy fallback)'}")
    log.info(f"  Poll     : every {poll_interval}s")
    log.info("=" * 60)

    # Wait for backend with exponential backoff
    backoff = 5
    while not client.health_check():
        if _shutdown:
            sys.exit(0)
        log.warning(f"Backend not reachable, retrying in {backoff}s...")
        time.sleep(backoff)
        backoff = min(backoff * 2, 60)
    log.info("Backend connection established.")

    tasks_completed = 0
    tasks_failed = 0

    while not _shutdown:
        try:
            task = client.fetch_task()

            if task is None:
                log.info(f"No tasks available. Completed: {tasks_completed}, Failed: {tasks_failed}")
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

            log.info(f"Task {task_id[:8]}... — layers={config.get('layers')}, "
                     f"act={config.get('activation')}, lr={config.get('learning_rate')}, "
                     f"epochs={config.get('epochs')}")

            try:
                if TORCH_AVAILABLE:
                    metrics = train_and_evaluate(config)
                else:
                    metrics = numpy_fallback_evaluate(config)
            except Exception as e:
                log.error(f"Training failed for task {task_id}: {e}")
                log.debug(traceback.format_exc())
                tasks_failed += 1
                time.sleep(5)
                continue

            success = client.submit_result(task_id, config, metrics)
            if success:
                tasks_completed += 1
            else:
                tasks_failed += 1

        except Exception as e:
            log.error(f"Unexpected error in worker loop: {e}")
            log.debug(traceback.format_exc())
            time.sleep(poll_interval)

    log.info(f"Worker shut down cleanly. Completed: {tasks_completed}, Failed: {tasks_failed}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="GreenWaveCoin AI Algorithm Worker")
    parser.add_argument(
        "--backend",
        default=os.environ.get("BACKEND_BASE_URL", "http://localhost:3000"),
        help="Backend coordinator base URL",
    )
    parser.add_argument(
        "--wallet",
        default=os.environ.get("WORKER_WALLET", ""),
        help="Ethereum wallet address for reward payouts",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("WORKER_API_KEY", ""),
        help="Worker API key for backend authentication",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=int(os.environ.get("POLL_INTERVAL", "30")),
        help="Seconds between task polls when queue is empty",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=int(os.environ.get("MAX_RETRIES", "3")),
        help="Max result submission retries before giving up",
    )
    args = parser.parse_args()

    if not args.wallet:
        log.error("Wallet address is required. Use --wallet or set WORKER_WALLET env var.")
        sys.exit(1)

    if not args.wallet.startswith("0x") or len(args.wallet) != 42:
        log.error("Invalid wallet address. Must be a 42-character 0x-prefixed Ethereum address.")
        sys.exit(1)

    run_worker(
        backend_url=args.backend,
        wallet=args.wallet,
        api_key=args.api_key,
        poll_interval=args.poll_interval,
        max_retries=args.max_retries,
    )


if __name__ == "__main__":
    main()
