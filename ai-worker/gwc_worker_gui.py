#!/usr/bin/env python3
"""
GreenWaveCoin AI Worker — Desktop GUI v1.0.10
=============================================
A polished, engaging Windows/Mac/Linux desktop app for running the
GreenWaveCoin distributed AI research worker.

Features:
- Real-time task progress bar with epoch tracking
- Live accuracy history chart
- Session stats: uptime, tasks/hr, estimated GWC earned
- Animated status indicator
- Current task architecture display
- Network latency monitor
- Color-coded activity feed
- Wallet address persistence (saved between sessions)
- System tray support (minimize to tray, keep running in background)
- Improved hash computation matching coordinator
- Better no-tasks UX with queue status
- Neural network visualizer with live signal propagation animation
- Live status bar with real-time metrics

Packaged with PyInstaller into a single .exe for Windows users.
"""

import hashlib
import json
import math
import os
import queue
import random
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, font as tkfont
from typing import Optional, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# Optional numpy import
# ---------------------------------------------------------------------------
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    class _NpStub:
        def array(self, x): return list(x)
        def zeros(self, *a, **k): return [[0.0]]
        def random(self): return self
        def randn(self, *a): return [[0.0]]
        def float32(self): return float
        def concatenate(self, arrays, axis=0): return sum(arrays, [])
        def mean(self, x): return sum(x) / len(x) if x else 0.0
        def std(self, x): return 0.0
        def dot(self, a, b): return 0.0
        class RandomState:
            def __init__(self, seed=None): pass
            def randn(self, *a): return [[0.0] * a[-1]] * a[0] if len(a) >= 2 else [0.0]
            def uniform(self, lo, hi): return (lo + hi) / 2
    np = _NpStub()

# ---------------------------------------------------------------------------
# Optional torch import
# ---------------------------------------------------------------------------
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# ---------------------------------------------------------------------------
# Optional pystray import (system tray support)
# ---------------------------------------------------------------------------
try:
    import pystray
    from PIL import Image as PILImage
    TRAY_AVAILABLE = True
except ImportError:
    TRAY_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BACKEND_URL    = "https://api.greenwavecoin.com"
WORKER_API_KEY = "gwc-worker-2025"
APP_VERSION    = "1.0.10"
POLL_INTERVAL  = 30
MAX_RETRIES    = 3
GWC_PER_TASK   = 0.05  # estimated GWC reward per completed task (~25-35 GWC/day at full speed)
GITHUB_RELEASE_URL = "https://api.github.com/repos/xDejaVu89/greenwavecoin/releases/latest"
DOWNLOAD_PAGE     = "https://greenwavecoin.com"

# Config file for persisting wallet address
CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".gwc_worker_config.json")

# Colour palette
C_BG       = "#0a0f1e"
C_PANEL    = "#0f1729"
C_BORDER   = "#1a2744"
C_ACCENT   = "#00e5cc"
C_ACCENT2  = "#0ea5e9"
C_TEXT     = "#ccd6f6"
C_MUTED    = "#8892b0"
C_SUCCESS  = "#10b981"
C_WARN     = "#f59e0b"
C_ERROR    = "#ef4444"
C_GOLD     = "#fbbf24"

# ---------------------------------------------------------------------------
# Config persistence
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Load saved config (wallet address, etc.) from disk."""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_config(data: dict):
    """Save config to disk."""
    try:
        existing = load_config()
        existing.update(data)
        with open(CONFIG_FILE, "w") as f:
            json.dump(existing, f, indent=2)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Training logic
# ---------------------------------------------------------------------------

def generate_benchmark_dataset(n_samples=8000, n_features=20, n_classes=4, seed=42):
    """Generate a reproducible classification dataset.
    Uses numpy vectorised ops so large n_samples is fast to generate.
    """
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features).astype(np.float32)
    w = rng.randn(n_features, n_classes).astype(np.float32)
    logits = X @ w  # (n_samples, n_classes)
    y = logits.argmax(axis=1).tolist()
    return X.tolist(), y


def numpy_fallback_evaluate(config: dict, progress_cb=None) -> dict:
    """Numpy-only fallback: does real matrix multiply training loop so it takes meaningful time."""
    layers     = config.get("layers", [64, 32])
    epochs     = min(int(config.get("epochs", 80)), 150)  # honour task epochs, cap at 150
    n_samples  = int(config.get("n_samples", 8000))
    seed       = int(config.get("dataset_seed", 42))
    lr         = float(config.get("learning_rate", 0.001))
    batch_size = int(config.get("batch_size", 64))

    X_np, y_np = generate_benchmark_dataset(n_samples=n_samples, seed=seed)
    X = np.array(X_np, dtype=np.float32)
    y = np.array(y_np, dtype=np.int32)

    # Simple 1-hidden-layer numpy network
    rng   = np.random.RandomState(seed)
    n_in  = X.shape[1]
    n_h   = layers[0] if layers else 64
    n_out = 4
    W1 = rng.randn(n_in, n_h).astype(np.float32) * 0.1
    b1 = np.zeros(n_h, dtype=np.float32)
    W2 = rng.randn(n_h, n_out).astype(np.float32) * 0.1
    b2 = np.zeros(n_out, dtype=np.float32)

    def softmax(z):
        e = np.exp(z - z.max(axis=1, keepdims=True))
        return e / e.sum(axis=1, keepdims=True)

    start = time.time()
    for ep in range(1, epochs + 1):
        idx = np.random.permutation(n_samples)
        for start_i in range(0, n_samples, batch_size):
            bi = idx[start_i:start_i + batch_size]
            xb, yb = X[bi], y[bi]
            h  = np.maximum(0, xb @ W1 + b1)  # ReLU
            out = softmax(h @ W2 + b2)
            # Cross-entropy gradient
            dout = out.copy(); dout[np.arange(len(yb)), yb] -= 1; dout /= len(yb)
            dW2 = h.T @ dout; db2 = dout.sum(0)
            dh  = dout @ W2.T * (h > 0)
            dW1 = xb.T @ dh;  db1 = dh.sum(0)
            W1 -= lr * dW1; b1 -= lr * db1
            W2 -= lr * dW2; b2 -= lr * db2
        if progress_cb and ep % max(1, epochs // 10) == 0:
            h   = np.maximum(0, X @ W1 + b1)
            acc = (softmax(h @ W2 + b2).argmax(axis=1) == y).mean()
            progress_cb(ep, epochs, float(acc))

    h   = np.maximum(0, X @ W1 + b1)
    out = softmax(h @ W2 + b2)
    accuracy = float((out.argmax(axis=1) == y).mean())
    loss     = float(-np.log(out[np.arange(n_samples), y] + 1e-9).mean())
    return {
        "accuracy": round(accuracy, 6),
        "training_time_seconds": round(time.time() - start, 2),
        "epochs_completed": epochs,
        "final_loss": round(loss, 6),
        "param_count": n_in * n_h + n_h + n_h * n_out + n_out,
        "torch_available": False,
        "mode": "numpy_fallback",
    }


def train_and_evaluate(config: dict, progress_cb=None) -> dict:
    layers          = config.get("layers", [64, 32])
    activation_name = config.get("activation", "relu")
    learning_rate   = float(config.get("learning_rate", 0.001))
    n_samples       = int(config.get("n_samples", 8000))  # use task-specified dataset size
    epochs          = min(int(config.get("epochs", 80)), 200)  # honour task epochs, cap at 200
    batch_size      = int(config.get("batch_size", 32))
    dropout_rate    = float(config.get("dropout", 0.0))
    seed            = int(config.get("dataset_seed", 42))

    torch.manual_seed(seed)

    activation_map = {
        "relu":       nn.ReLU,
        "tanh":       nn.Tanh,
        "sigmoid":    nn.Sigmoid,
        "leaky_relu": lambda: nn.LeakyReLU(0.1),
        "elu":        nn.ELU,
    }
    ActClass = activation_map.get(activation_name, nn.ReLU)

    X_np, y_np = generate_benchmark_dataset(n_samples=n_samples, seed=seed)
    n_features = len(X_np[0]) if X_np else 20
    n_classes  = 4

    X_t = torch.tensor(X_np, dtype=torch.float32)
    y_t = torch.tensor(y_np, dtype=torch.long)
    dataset = TensorDataset(X_t, y_t)
    loader  = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Build model with optional dropout
    layer_sizes = [n_features] + layers + [n_classes]
    net_layers  = []
    for i in range(len(layer_sizes) - 1):
        net_layers.append(nn.Linear(layer_sizes[i], layer_sizes[i + 1]))
        if i < len(layer_sizes) - 2:
            net_layers.append(ActClass())
            if dropout_rate > 0:
                net_layers.append(nn.Dropout(dropout_rate))
    model = nn.Sequential(*net_layers)

    opt_name = config.get("optimizer", "adam").lower()
    if opt_name == "sgd":
        optimizer = optim.SGD(model.parameters(), lr=learning_rate)
    elif opt_name == "rmsprop":
        optimizer = optim.RMSprop(model.parameters(), lr=learning_rate)
    else:
        optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    criterion  = nn.CrossEntropyLoss()
    start      = time.time()
    final_loss = 0.0

    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in loader:
            optimizer.zero_grad()
            out  = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()
            final_loss = loss.item()
        # Intermediate accuracy for progress callback
        model.eval()
        with torch.no_grad():
            preds  = model(X_t).argmax(dim=1)
            ep_acc = (preds == y_t).float().mean().item()
        if progress_cb:
            progress_cb(epoch, epochs, ep_acc)

    training_time = round(time.time() - start, 2)
    model.eval()
    with torch.no_grad():
        preds    = model(X_t).argmax(dim=1)
        accuracy = round((preds == y_t).float().mean().item(), 6)

    param_count = sum(p.numel() for p in model.parameters())

    return {
        "accuracy": accuracy,
        "training_time_seconds": training_time,
        "epochs_completed": epochs,
        "final_loss": round(final_loss, 6),
        "param_count": param_count,
        "torch_available": True,
        "mode": "pytorch",
    }


# ---------------------------------------------------------------------------
# Result fingerprinting — matches coordinator hash exactly
# ---------------------------------------------------------------------------

def compute_result_hash(task_id: str, config: dict, metrics: dict) -> str:
    """
    Compute result hash matching the coordinator's verification logic.
    Uses compact JSON (no spaces) and sha256, prefixed with 0x.
    """
    canonical = json.dumps({
        "task_id": task_id,
        "config": config,
        "accuracy": metrics["accuracy"],
        "final_loss": metrics.get("final_loss", -1.0),
        "param_count": metrics.get("param_count", 0),
    }, sort_keys=True, separators=(',', ':'))
    return "0x" + hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Backend client
# ---------------------------------------------------------------------------

class BackendClient:
    def __init__(self, backend_url, wallet, api_key="", max_retries=3):
        self.backend_url = backend_url.rstrip("/")
        self.wallet      = wallet
        self.api_key     = api_key
        self.max_retries = max_retries
        self.session     = requests.Session()
        retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504],
                      allowed_methods=["GET", "POST"])
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.session.mount("http://",  HTTPAdapter(max_retries=retry))
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": f"GreenWaveCoin-Worker/{APP_VERSION}",
        })
        if api_key:
            self.session.headers.update({"X-API-Key": api_key})

    def health_check(self):
        try:
            t0 = time.time()
            r  = self.session.get(f"{self.backend_url}/health", timeout=10)
            ms = int((time.time() - t0) * 1000)
            return r.status_code == 200, ms
        except Exception:
            return False, 0

    def fetch_task(self):
        """GET /api/tasks — returns next task or None if queue empty (204)."""
        try:
            r = self.session.get(
                f"{self.backend_url}/api/tasks",
                timeout=30,
            )
            if r.status_code == 200:
                return r.json().get("task")
            # 204 = queue empty
            return None
        except Exception:
            return None

    def get_queue_length(self) -> int:
        """Fetch current queue length from /api/tasks/stats."""
        try:
            r = self.session.get(f"{self.backend_url}/api/tasks/stats", timeout=8)
            if r.status_code == 200:
                return int(r.json().get("queueLength", 0))
        except Exception:
            pass
        return 0

    def submit_result(self, task_id: str, config: dict, metrics: dict) -> bool:
        """POST /api/results — submit completed task result."""
        result_hash = compute_result_hash(task_id, config, metrics)
        body = {
            "id": task_id,
            "worker": self.wallet,
            "hash": result_hash,
            "signature": "0x" + "0" * 130,  # placeholder; server verifies hash
            "metrics": metrics,
            "config": config,
        }
        for attempt in range(1, self.max_retries + 1):
            try:
                r = self.session.post(
                    f"{self.backend_url}/api/results",
                    json=body,
                    timeout=30,
                )
                if r.status_code in (200, 201):
                    return True
                if r.status_code == 401:
                    return False
            except Exception:
                pass
            if attempt < self.max_retries:
                time.sleep(2 ** attempt)
        return False


# ---------------------------------------------------------------------------
# Accuracy sparkline canvas widget
# ---------------------------------------------------------------------------

class AccuracyChart(tk.Canvas):
    """Mini line chart showing last N task accuracies."""

    MAX_POINTS = 20

    def __init__(self, parent, **kwargs):
        super().__init__(parent, bg=C_PANEL, highlightthickness=0, **kwargs)
        self._data: List[float] = []
        self.bind("<Configure>", lambda e: self._redraw())

    def add_point(self, acc: float):
        self._data.append(acc)
        if len(self._data) > self.MAX_POINTS:
            self._data.pop(0)
        self._redraw()

    def _redraw(self):
        self.delete("all")
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 10 or h < 10:
            return

        pad_x, pad_y = 8, 8
        inner_w = w - pad_x * 2
        inner_h = h - pad_y * 2

        # Grid lines
        for pct in (0.25, 0.5, 0.75, 1.0):
            y = pad_y + inner_h * (1 - pct)
            self.create_line(pad_x, y, w - pad_x, y, fill=C_BORDER, dash=(2, 4))
            self.create_text(pad_x - 2, y, text=f"{pct:.0%}",
                             anchor="e", font=("Consolas", 7), fill=C_MUTED)

        if len(self._data) < 2:
            if self._data:
                cx = pad_x + inner_w / 2
                cy = pad_y + inner_h * (1 - self._data[0])
                self.create_oval(cx - 3, cy - 3, cx + 3, cy + 3, fill=C_ACCENT, outline="")
            return

        step = inner_w / (len(self._data) - 1)
        pts  = []
        for i, v in enumerate(self._data):
            x = pad_x + i * step
            y = pad_y + inner_h * (1 - max(0.0, min(1.0, v)))
            pts.append((x, y))

        # Gradient fill
        for i in range(len(pts) - 1):
            x1, y1 = pts[i]
            x2, y2 = pts[i + 1]
            self.create_polygon(
                x1, y1, x2, y2,
                x2, pad_y + inner_h, x1, pad_y + inner_h,
                fill="#00e5cc22", outline="",
            )

        # Line
        flat = [coord for p in pts for coord in p]
        self.create_line(*flat, fill=C_ACCENT, width=2, smooth=True)

        # Dots
        for x, y in pts:
            self.create_oval(x - 3, y - 3, x + 3, y + 3, fill=C_ACCENT, outline=C_BG, width=1)

        # Latest value label
        lx, ly = pts[-1]
        self.create_text(lx + 4, ly - 8, text=f"{self._data[-1]:.1%}",
                         anchor="w", font=("Consolas", 8, "bold"), fill=C_ACCENT)


# ---------------------------------------------------------------------------
# Animated progress bar
# ---------------------------------------------------------------------------

class AnimatedProgressBar(tk.Canvas):
    def __init__(self, parent, height=8, **kwargs):
        super().__init__(parent, height=height, bg=C_PANEL, highlightthickness=0, **kwargs)
        self._progress = 0.0
        self._anim_id  = None
        self._target   = 0.0
        self.bind("<Configure>", lambda e: self._draw())

    def set_progress(self, value: float):
        self._target = max(0.0, min(1.0, value))
        self._animate()

    def reset(self):
        if self._anim_id:
            self.after_cancel(self._anim_id)
            self._anim_id = None
        self._progress = 0.0
        self._target   = 0.0
        self._draw()

    def _animate(self):
        if abs(self._progress - self._target) < 0.005:
            self._progress = self._target
            self._draw()
            return
        self._progress += (self._target - self._progress) * 0.15
        self._draw()
        self._anim_id = self.after(30, self._animate)

    def _draw(self):
        self.delete("all")
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 4:
            return
        # Background track
        self.create_rectangle(0, 0, w, h, fill=C_BORDER, outline="")
        # Fill
        fill_w = int(w * self._progress)
        if fill_w > 0:
            self.create_rectangle(0, 0, fill_w, h, fill=C_ACCENT, outline="")
        # Percentage text
        if self._progress > 0.05:
            self.create_text(w // 2, h // 2,
                             text=f"{self._progress:.0%}",
                             font=("Segoe UI", 7, "bold"),
                             fill=C_BG if self._progress > 0.5 else C_TEXT)


# ---------------------------------------------------------------------------
# Pulsing status dot
# ---------------------------------------------------------------------------

class PulsingDot(tk.Canvas):
    STATES = {
        "idle":       (C_MUTED,    False),
        "connecting": (C_WARN,     True),
        "running":    (C_SUCCESS,  True),
        "stopped":    (C_ERROR,    False),
    }

    def __init__(self, parent, size=10, **kwargs):
        super().__init__(parent, width=size, height=size,
                         bg=C_BG, highlightthickness=0, **kwargs)
        self._size    = size
        self._state   = "idle"
        self._phase   = 0.0
        self._anim_id = None
        self._draw()

    def set_state(self, state: str):
        self._state = state
        color, pulse = self.STATES.get(state, (C_MUTED, False))
        if pulse and not self._anim_id:
            self._pulse()
        elif not pulse:
            if self._anim_id:
                self.after_cancel(self._anim_id)
                self._anim_id = None
            self._phase = 0.0
            self._draw()

    def _pulse(self):
        self._phase = (self._phase + 0.12) % (2 * math.pi)
        self._draw()
        self._anim_id = self.after(50, self._pulse)

    def _draw(self):
        self.delete("all")
        color, pulse = self.STATES.get(self._state, (C_MUTED, False))
        s = self._size
        if pulse:
            alpha = 0.5 + 0.5 * math.sin(self._phase)
            pad = int(2 + 2 * alpha)
        else:
            pad = 2
        self.create_oval(pad, pad, s - pad, s - pad, fill=color, outline="")


# ---------------------------------------------------------------------------
# Neural Network Visualizer — animated signal propagation
# ---------------------------------------------------------------------------

class NeuralNetCanvas(tk.Canvas):
    """
    Draws a live neural network diagram with animated signal pulses flowing
    forward through layers. Reflects the actual architecture being trained.

    States:
      idle     — slow dim background pulse, muted colours
      running  — bright signals fire continuously through layers
      stopped  — static, all nodes dim
    """

    # Pulse: a dict with keys layer_idx, node_idx, progress (0→1), color
    def __init__(self, parent, **kwargs):
        super().__init__(parent, bg=C_BG, highlightthickness=0, **kwargs)
        self._state   = "idle"
        self._layers  = [4, 8, 6, 4]   # default architecture (input, hidden..., output)
        self._pulses  = []              # active signal pulses
        self._phase   = 0.0            # global animation phase
        self._anim_id = None
        self._tick    = 0
        self._last_acc = 0.0
        self._last_loss = 0.0
        self._spawn_counter = 0
        self.bind("<Configure>", lambda e: self._redraw_static())
        self._start_animation()

    # ── Public API ──────────────────────────────────────────────────────────

    def set_state(self, state: str):
        self._state = state

    def set_architecture(self, layers: list):
        """Update the displayed architecture (list of layer sizes)."""
        # Cap display at 6 layers, 12 nodes per layer for visual clarity
        capped = [min(n, 12) for n in layers[:6]]
        if capped != self._layers:
            self._layers = capped
            self._pulses.clear()

    def set_metrics(self, acc: float = 0.0, loss: float = 0.0):
        self._last_acc  = acc
        self._last_loss = loss

    # ── Internal ────────────────────────────────────────────────────────────

    def _start_animation(self):
        self._animate()

    def _animate(self):
        self._phase = (self._phase + 0.04) % (2 * math.pi)
        self._tick += 1

        # Spawn new pulses when running
        if self._state == "running":
            self._spawn_counter += 1
            # Spawn a new pulse every ~12 ticks (~480ms at 40ms interval)
            if self._spawn_counter >= 12:
                self._spawn_counter = 0
                self._spawn_pulse()
        elif self._state == "idle":
            # Occasional slow pulse in idle
            self._spawn_counter += 1
            if self._spawn_counter >= 60:
                self._spawn_counter = 0
                self._spawn_pulse(dim=True)

        # Advance existing pulses
        speed = 0.06 if self._state == "running" else 0.025
        dead  = []
        for p in self._pulses:
            p["progress"] += speed
            if p["progress"] >= 1.0:
                # Jump to next layer
                p["layer_idx"] += 1
                p["progress"]   = 0.0
                if p["layer_idx"] >= len(self._layers) - 1:
                    dead.append(p)
                else:
                    # Pick a random target node in the next layer
                    p["from_node"] = p["to_node"]
                    p["to_node"]   = random.randint(0, self._layers[p["layer_idx"] + 1] - 1)
        for p in dead:
            self._pulses.remove(p)

        self._redraw()
        self._anim_id = self.after(40, self._animate)

    def _spawn_pulse(self, dim=False):
        if len(self._layers) < 2:
            return
        # Cap concurrent pulses
        max_pulses = 8 if self._state == "running" else 2
        if len(self._pulses) >= max_pulses:
            return
        # Pick a random starting node in layer 0
        from_node = random.randint(0, self._layers[0] - 1)
        to_node   = random.randint(0, self._layers[1] - 1)
        if dim:
            color = C_BORDER
        else:
            # Cycle through accent colours for variety
            color = random.choice([C_ACCENT, C_ACCENT2, C_SUCCESS])
        self._pulses.append({
            "layer_idx": 0,
            "from_node": from_node,
            "to_node":   to_node,
            "progress":  0.0,
            "color":     color,
        })

    def _node_positions(self, w, h):
        """Return {layer_idx: [(x, y), ...]} for all nodes."""
        n_layers  = len(self._layers)
        pad_x     = 40
        pad_y     = 30
        inner_w   = w - pad_x * 2
        inner_h   = h - pad_y * 2
        positions = {}
        for li, n_nodes in enumerate(self._layers):
            x = pad_x + (li / max(n_layers - 1, 1)) * inner_w
            positions[li] = []
            for ni in range(n_nodes):
                y = pad_y + (ni / max(n_nodes - 1, 1)) * inner_h if n_nodes > 1 else h / 2
                positions[li].append((x, y))
        return positions

    def _hex_to_rgb(self, hex_color: str):
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    def _lerp_color(self, c1: str, c2: str, t: float) -> str:
        r1, g1, b1 = self._hex_to_rgb(c1)
        r2, g2, b2 = self._hex_to_rgb(c2)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        return f"#{r:02x}{g:02x}{b:02x}"

    def _redraw_static(self):
        """Called on resize — just trigger a full redraw."""
        self._redraw()

    def _redraw(self):
        self.delete("all")
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 40 or h < 40:
            return

        pos = self._node_positions(w, h)
        n_layers = len(self._layers)

        # ── Background subtle grid ──────────────────────────────────────────
        grid_color = "#0d1428"
        for gx in range(0, w, 40):
            self.create_line(gx, 0, gx, h, fill=grid_color)
        for gy in range(0, h, 40):
            self.create_line(0, gy, w, gy, fill=grid_color)

        # ── Draw connections (edges) ────────────────────────────────────────
        edge_color = "#1a2744"
        for li in range(n_layers - 1):
            for ni, (x1, y1) in enumerate(pos[li]):
                for nj, (x2, y2) in enumerate(pos[li + 1]):
                    self.create_line(x1, y1, x2, y2, fill=edge_color, width=1)

        # ── Draw animated pulse along edges ────────────────────────────────
        for p in self._pulses:
            li   = p["layer_idx"]
            fn   = p["from_node"]
            tn   = p["to_node"]
            prog = p["progress"]
            col  = p["color"]
            if li >= n_layers - 1:
                continue
            if fn >= len(pos[li]) or tn >= len(pos[li + 1]):
                continue
            x1, y1 = pos[li][fn]
            x2, y2 = pos[li + 1][tn]
            # Interpolate position
            px = x1 + (x2 - x1) * prog
            py = y1 + (y2 - y1) * prog
            # Draw glowing trail
            for trail_step in range(5):
                t_prog = prog - trail_step * 0.04
                if t_prog < 0:
                    break
                tx = x1 + (x2 - x1) * t_prog
                ty = y1 + (y2 - y1) * t_prog
                alpha = 1.0 - trail_step * 0.2
                trail_col = self._lerp_color(col, C_BG, 1.0 - alpha * 0.8)
                r = max(1, int(4 * alpha))
                self.create_oval(tx - r, ty - r, tx + r, ty + r,
                                 fill=trail_col, outline="")

        # ── Draw nodes ─────────────────────────────────────────────────────
        for li in range(n_layers):
            for ni, (x, y) in enumerate(pos[li]):
                # Determine node brightness based on state and active pulses
                is_active = any(
                    p["layer_idx"] == li and (p["from_node"] == ni or p["to_node"] == ni)
                    for p in self._pulses
                )
                if self._state == "running":
                    base_glow = 0.3 + 0.15 * math.sin(self._phase + li * 0.8 + ni * 0.4)
                    if is_active:
                        base_glow = 1.0
                elif self._state == "idle":
                    base_glow = 0.1 + 0.08 * math.sin(self._phase * 0.5 + li * 0.5)
                else:
                    base_glow = 0.08

                # Outer glow ring (only when running/active)
                if self._state == "running" and base_glow > 0.5:
                    glow_r = 10
                    glow_col = self._lerp_color(C_BG, C_ACCENT, base_glow * 0.4)
                    self.create_oval(x - glow_r, y - glow_r, x + glow_r, y + glow_r,
                                     fill=glow_col, outline="")

                # Node body
                node_r = 5
                if li == 0:
                    # Input layer — blue tint
                    node_col = self._lerp_color(C_BORDER, C_ACCENT2, base_glow)
                elif li == n_layers - 1:
                    # Output layer — gold tint
                    node_col = self._lerp_color(C_BORDER, C_GOLD, base_glow)
                else:
                    # Hidden layers — teal
                    node_col = self._lerp_color(C_BORDER, C_ACCENT, base_glow)

                self.create_oval(x - node_r, y - node_r, x + node_r, y + node_r,
                                 fill=node_col, outline=C_BG, width=1)

        # ── Layer labels ───────────────────────────────────────────────────
        label_y = h - 14
        for li, n_nodes in enumerate(self._layers):
            x = pos[li][0][0]
            if li == 0:
                lbl = f"IN\n{n_nodes}"
            elif li == n_layers - 1:
                lbl = f"OUT\n{n_nodes}"
            else:
                lbl = f"L{li}\n{n_nodes}"
            self.create_text(x, label_y, text=lbl.replace("\n", " "),
                             font=("Consolas", 7), fill=C_MUTED, anchor="s")

        # ── Status overlay (top-right) ─────────────────────────────────────
        if self._state == "running":
            status_text = f"TRAINING  acc={self._last_acc:.1%}  loss={self._last_loss:.4f}"
            status_col  = C_SUCCESS
        elif self._state == "idle":
            status_text = "IDLE — waiting for tasks"
            status_col  = C_MUTED
        elif self._state == "connecting":
            status_text = "CONNECTING TO NETWORK…"
            status_col  = C_WARN
        else:
            status_text = "STOPPED"
            status_col  = C_ERROR

        self.create_text(w - 8, 10, text=status_text,
                         font=("Consolas", 8), fill=status_col, anchor="ne")

        # ── Architecture label (top-left) ──────────────────────────────────
        arch_str = "→".join(str(n) for n in self._layers)
        self.create_text(8, 10, text=f"arch: {arch_str}",
                         font=("Consolas", 8), fill=C_MUTED, anchor="nw")


# ---------------------------------------------------------------------------
# Live status bar
# ---------------------------------------------------------------------------

class StatusBar(tk.Frame):
    """
    A single-row status bar at the bottom of the window showing live metrics.
    Segments: [state pill] | Tasks: N | Epoch: N/N | Acc: N% | GWC: N | Uptime: HH:MM
    """

    def __init__(self, parent, **kwargs):
        super().__init__(parent, bg="#07101f", **kwargs)
        self._segments = {}
        self._build()

    def _build(self):
        # Left side
        left = tk.Frame(self, bg="#07101f")
        left.pack(side="left", padx=8)

        self._state_lbl = tk.Label(
            left, text="● IDLE", font=("Consolas", 8, "bold"),
            fg=C_MUTED, bg="#07101f", padx=6, pady=3,
        )
        self._state_lbl.pack(side="left", padx=(0, 12))

        for key, label in [
            ("tasks",   "Tasks"),
            ("epoch",   "Epoch"),
            ("acc",     "Accuracy"),
            ("gwc",     "Est. GWC"),
            ("uptime",  "Uptime"),
            ("latency", "Latency"),
        ]:
            seg = tk.Frame(self, bg="#07101f")
            seg.pack(side="left", padx=10)
            tk.Label(seg, text=label.upper(), font=("Consolas", 7),
                     fg="#3a4a6b", bg="#07101f").pack(anchor="w")
            val = tk.Label(seg, text="—", font=("Consolas", 9, "bold"),
                           fg=C_MUTED, bg="#07101f")
            val.pack(anchor="w")
            self._segments[key] = val

        # Right side — version
        right = tk.Frame(self, bg="#07101f")
        right.pack(side="right", padx=12)
        tk.Label(right, text=f"GreenWaveCoin Worker v{APP_VERSION}  •  greenwavecoin.com  •  Polygon",
                 font=("Consolas", 7), fg="#2a3a5a", bg="#07101f").pack()

    def update_state(self, state: str):
        colors = {
            "running":    (C_SUCCESS, "● RUNNING"),
            "idle":       (C_MUTED,   "● IDLE"),
            "connecting": (C_WARN,    "● CONNECTING"),
            "stopped":    (C_ERROR,   "● STOPPED"),
        }
        col, text = colors.get(state, (C_MUTED, f"● {state.upper()}"))
        self._state_lbl.configure(text=text, fg=col)

    def update(self, **kwargs):
        """Update individual segments. Keys: tasks, epoch, acc, gwc, uptime, latency."""
        color_map = {
            "tasks":   C_ACCENT,
            "epoch":   C_ACCENT2,
            "acc":     C_SUCCESS,
            "gwc":     C_GOLD,
            "uptime":  C_MUTED,
            "latency": C_MUTED,
        }
        for key, value in kwargs.items():
            if key in self._segments:
                self._segments[key].configure(
                    text=str(value),
                    fg=color_map.get(key, C_TEXT),
                )


# ---------------------------------------------------------------------------
# Main application
# ---------------------------------------------------------------------------

class GWCWorkerApp:

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"GreenWaveCoin Worker  v{APP_VERSION}")
        self.root.geometry("860x680")
        self.root.minsize(720, 560)
        self.root.configure(bg=C_BG)

        # State
        self._worker_thread: Optional[threading.Thread] = None
        self._running          = False
        self._log_queue: queue.Queue = queue.Queue()
        self._tasks_completed  = 0
        self._tasks_failed     = 0
        self._gwc_earned       = 0.0
        self._start_time: Optional[float] = None
        self._current_epoch    = 0
        self._total_epochs     = 1
        self._current_task_info = ""
        self._latency_ms       = 0
        self._acc_history: List[float] = []
        self._tray_icon        = None
        self._current_acc      = 0.0
        self._current_loss     = 0.0

        self._build_ui()
        self._poll_log_queue()
        self._tick_uptime()
        # Check for updates 3 seconds after startup (non-blocking)
        self.root.after(3000, self._check_for_update)

        # Load saved wallet
        cfg = load_config()
        saved_wallet = cfg.get("wallet", "")
        if saved_wallet and saved_wallet.startswith("0x") and len(saved_wallet) == 42:
            self.wallet_entry.configure(fg=C_TEXT)
            self.wallet_entry.delete(0, "end")
            self.wallet_entry.insert(0, saved_wallet)

    # -----------------------------------------------------------------------
    # UI construction
    # -----------------------------------------------------------------------

    def _build_ui(self):
        # ── Top bar ──────────────────────────────────────────────────────────
        topbar = tk.Frame(self.root, bg=C_BG)
        topbar.pack(fill="x", padx=20, pady=(16, 0))

        left = tk.Frame(topbar, bg=C_BG)
        left.pack(side="left")

        tk.Label(left, text="GreenWaveCoin", font=("Segoe UI", 20, "bold"),
                 fg=C_ACCENT, bg=C_BG).pack(side="left")
        tk.Label(left, text=" Worker", font=("Segoe UI", 20),
                 fg=C_TEXT, bg=C_BG).pack(side="left")
        tk.Label(left, text=f"  v{APP_VERSION}", font=("Segoe UI", 10),
                 fg=C_MUTED, bg=C_BG).pack(side="left", pady=(6, 0))

        right = tk.Frame(topbar, bg=C_BG)
        right.pack(side="right")

        self._dot = PulsingDot(right)
        self._dot.pack(side="left", padx=(0, 6))
        self._status_lbl = tk.Label(right, text="Idle", font=("Segoe UI", 10),
                                    fg=C_MUTED, bg=C_BG)
        self._status_lbl.pack(side="left")

        tk.Label(self.root, text="Contribute idle CPU to AI research. Earn GWC on Polygon.",
                 font=("Segoe UI", 9), fg=C_MUTED, bg=C_BG).pack(anchor="w", padx=22, pady=(2, 0))

        self._sep()

        # ── Wallet row ───────────────────────────────────────────────────────
        wf = tk.Frame(self.root, bg=C_BG)
        wf.pack(fill="x", padx=20, pady=(0, 8))

        tk.Label(wf, text="Polygon Wallet Address", font=("Segoe UI", 9, "bold"),
                 fg=C_TEXT, bg=C_BG).pack(anchor="w")
        tk.Label(wf, text="GWC rewards will be claimable at this address  •  Saved automatically",
                 font=("Segoe UI", 8), fg=C_MUTED, bg=C_BG).pack(anchor="w", pady=(0, 4))

        entry_frame = tk.Frame(wf, bg=C_BORDER, padx=1, pady=1)
        entry_frame.pack(fill="x")
        inner = tk.Frame(entry_frame, bg=C_PANEL)
        inner.pack(fill="x")

        self.wallet_var   = tk.StringVar()
        self.wallet_entry = tk.Entry(
            inner, textvariable=self.wallet_var,
            font=("Consolas", 11), bg=C_PANEL, fg=C_MUTED,
            insertbackground=C_ACCENT, relief="flat", bd=0,
        )
        self.wallet_entry.pack(fill="x", ipady=9, ipadx=10)
        self.wallet_entry.insert(0, "0x...")
        self.wallet_entry.bind("<FocusIn>",  self._clear_placeholder)
        self.wallet_entry.bind("<FocusOut>", self._restore_placeholder)

        # ── Buttons ──────────────────────────────────────────────────────────
        bf = tk.Frame(self.root, bg=C_BG)
        bf.pack(fill="x", padx=20, pady=(0, 10))

        self.start_btn = tk.Button(
            bf, text="▶  Start Worker",
            font=("Segoe UI", 11, "bold"),
            bg=C_ACCENT, fg=C_BG,
            activebackground="#00bfa5", activeforeground=C_BG,
            relief="flat", bd=0, padx=24, pady=10,
            cursor="hand2", command=self._start_worker,
        )
        self.start_btn.pack(side="left", padx=(0, 10))

        self.stop_btn = tk.Button(
            bf, text="■  Stop",
            font=("Segoe UI", 11, "bold"),
            bg=C_BORDER, fg=C_MUTED,
            activebackground="#2a3d5e", activeforeground=C_TEXT,
            relief="flat", bd=0, padx=24, pady=10,
            cursor="hand2", state="disabled",
            command=self._stop_worker,
        )
        self.stop_btn.pack(side="left")

        # Minimize to tray button (only shown if pystray available)
        if TRAY_AVAILABLE:
            self.tray_btn = tk.Button(
                bf, text="⊟  Minimize to Tray",
                font=("Segoe UI", 9),
                bg=C_BORDER, fg=C_MUTED,
                activebackground="#2a3d5e", activeforeground=C_TEXT,
                relief="flat", bd=0, padx=12, pady=10,
                cursor="hand2",
                command=self._minimize_to_tray,
            )
            self.tray_btn.pack(side="left", padx=(10, 0))

        # Network badge
        self._net_lbl = tk.Label(bf, text="⬤  Checking network…",
                                  font=("Segoe UI", 9), fg=C_MUTED, bg=C_BG)
        self._net_lbl.pack(side="right", padx=4)

        self._sep()

        # ── Main content area ────────────────────────────────────────────────
        content = tk.Frame(self.root, bg=C_BG)
        content.pack(fill="both", expand=True, padx=20, pady=(0, 0))
        content.columnconfigure(0, weight=3)
        content.columnconfigure(1, weight=2)
        content.rowconfigure(0, weight=1)

        # Left column
        left_col = tk.Frame(content, bg=C_BG)
        left_col.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        left_col.columnconfigure(0, weight=1)
        left_col.rowconfigure(0, weight=0)   # task panel — fixed height
        left_col.rowconfigure(1, weight=2)   # nn canvas — grows
        left_col.rowconfigure(2, weight=3)   # activity log — grows most

        # ── Current task panel ───────────────────────────────────────────────
        task_panel = self._panel(left_col, "Current Task")
        task_panel.grid(row=0, column=0, sticky="nsew", pady=(0, 6))

        self._task_id_lbl = tk.Label(task_panel, text="—  Waiting for task",
                                      font=("Segoe UI", 10, "bold"),
                                      fg=C_TEXT, bg=C_PANEL, anchor="w")
        self._task_id_lbl.pack(fill="x", padx=12, pady=(8, 2))

        self._task_arch_lbl = tk.Label(task_panel, text="Architecture: —",
                                        font=("Consolas", 9),
                                        fg=C_MUTED, bg=C_PANEL, anchor="w")
        self._task_arch_lbl.pack(fill="x", padx=12)

        self._task_opt_lbl = tk.Label(task_panel, text="Optimizer: —  |  LR: —",
                                       font=("Consolas", 9),
                                       fg=C_MUTED, bg=C_PANEL, anchor="w")
        self._task_opt_lbl.pack(fill="x", padx=12, pady=(0, 8))

        # Epoch progress
        ep_row = tk.Frame(task_panel, bg=C_PANEL)
        ep_row.pack(fill="x", padx=12, pady=(0, 4))
        tk.Label(ep_row, text="Epoch Progress", font=("Segoe UI", 8),
                 fg=C_MUTED, bg=C_PANEL).pack(side="left")
        self._epoch_lbl = tk.Label(ep_row, text="—", font=("Segoe UI", 8, "bold"),
                                    fg=C_ACCENT, bg=C_PANEL)
        self._epoch_lbl.pack(side="right")

        self._progress_bar = AnimatedProgressBar(task_panel)
        self._progress_bar.pack(fill="x", padx=12, pady=(0, 10))

        # Live accuracy during training
        acc_row = tk.Frame(task_panel, bg=C_PANEL)
        acc_row.pack(fill="x", padx=12, pady=(0, 10))
        tk.Label(acc_row, text="Live Accuracy", font=("Segoe UI", 8),
                 fg=C_MUTED, bg=C_PANEL).pack(side="left")
        self._live_acc_lbl = tk.Label(acc_row, text="—", font=("Segoe UI", 10, "bold"),
                                       fg=C_ACCENT, bg=C_PANEL)
        self._live_acc_lbl.pack(side="right")

        # ── Neural Network Visualizer ─────────────────────────────────────────
        nn_panel = self._panel(left_col, "Neural Network — Live Compute")
        nn_panel.grid(row=1, column=0, sticky="nsew", pady=(0, 6))

        self._nn_canvas = NeuralNetCanvas(nn_panel)
        self._nn_canvas.pack(fill="both", expand=True, padx=4, pady=(4, 8))

        # ── Activity log ─────────────────────────────────────────────────────
        log_panel = self._panel(left_col, "Activity Log")
        log_panel.grid(row=2, column=0, sticky="nsew")

        self.log_text = scrolledtext.ScrolledText(
            log_panel, font=("Consolas", 8),
            bg="#060b18", fg=C_MUTED,
            insertbackground=C_ACCENT,
            relief="flat", bd=0, state="disabled",
        )
        self.log_text.pack(fill="both", expand=True, padx=1, pady=1)
        self.log_text.tag_config("INFO",    foreground=C_MUTED)
        self.log_text.tag_config("SUCCESS", foreground=C_SUCCESS)
        self.log_text.tag_config("WARNING", foreground=C_WARN)
        self.log_text.tag_config("ERROR",   foreground=C_ERROR)
        self.log_text.tag_config("HEADER",  foreground=C_TEXT,
                                  font=("Consolas", 8, "bold"))

        # Right column
        right_col = tk.Frame(content, bg=C_BG)
        right_col.grid(row=0, column=1, sticky="nsew")
        right_col.columnconfigure(0, weight=1)
        right_col.rowconfigure(1, weight=1)   # chart expands

        # ── Stats cards ───────────────────────────────────────────────────────
        stats_panel = self._panel(right_col, "Session Stats")
        stats_panel.pack(fill="x", pady=(0, 8))

        sg = tk.Frame(stats_panel, bg=C_PANEL)
        sg.pack(fill="x", padx=8, pady=8)
        sg.columnconfigure(0, weight=1)
        sg.columnconfigure(1, weight=1)

        self._stat_completed = self._stat_card(sg, "Tasks Done",    "0",      C_ACCENT,  0, 0)
        self._stat_failed    = self._stat_card(sg, "Failed",        "0",      C_ERROR,   0, 1)
        self._stat_gwc       = self._stat_card(sg, "Est. GWC",      "0.00",   C_GOLD,    1, 0)
        self._stat_rate      = self._stat_card(sg, "Tasks / hr",    "—",      C_ACCENT2, 1, 1)
        self._stat_uptime    = self._stat_card(sg, "Uptime",        "00:00",  C_MUTED,   2, 0)
        self._stat_success   = self._stat_card(sg, "Success Rate",  "—",      C_SUCCESS, 2, 1)
        self._stat_network   = self._stat_card(sg, "Network Total", "—",      C_ACCENT2, 3, 0)
        self._stat_workers   = self._stat_card(sg, "Active Workers","—",      C_MUTED,   3, 1)

        # ── Accuracy chart ────────────────────────────────────────────────────
        chart_panel = self._panel(right_col, "Accuracy History")
        chart_panel.pack(fill="both", expand=True)

        self._chart = AccuracyChart(chart_panel, height=160)
        self._chart.pack(fill="both", expand=True, padx=4, pady=4)

        # ── Status bar (bottom) ───────────────────────────────────────────────
        self._statusbar = StatusBar(self.root)
        self._statusbar.pack(fill="x", side="bottom")

        # ── Initial log messages ──────────────────────────────────────────────
        self._log("HEADER", f"GreenWaveCoin Worker v{APP_VERSION} ready.")
        self._log("INFO",   f"Coordinator : {BACKEND_URL}")
        self._log("INFO",   f"Compute     : {'PyTorch' if TORCH_AVAILABLE else 'NumPy fallback'}")
        self._log("INFO",   "Enter your wallet address and click Start Worker.")

        # Start network ping loop
        self._ping_network()
        # Start network stats poll
        self._poll_network_stats()

    # -----------------------------------------------------------------------
    # Helper builders
    # -----------------------------------------------------------------------

    def _sep(self):
        ttk.Separator(self.root, orient="horizontal").pack(fill="x", padx=20, pady=6)

    def _panel(self, parent, title: str) -> tk.Frame:
        outer = tk.Frame(parent, bg=C_BORDER, padx=1, pady=1)
        # Make outer frame itself expand when placed with grid sticky=nsew
        outer.rowconfigure(0, weight=1)
        outer.columnconfigure(0, weight=1)
        inner = tk.Frame(outer, bg=C_PANEL)
        inner.grid(row=0, column=0, sticky="nsew")
        tk.Label(inner, text=title.upper(), font=("Segoe UI", 8, "bold"),
                 fg=C_MUTED, bg=C_PANEL).pack(anchor="w", padx=10, pady=(8, 4))
        ttk.Separator(inner, orient="horizontal").pack(fill="x")
        return inner

    def _stat_card(self, parent, label: str, value: str, color: str,
                   row: int, col: int) -> tk.Label:
        f = tk.Frame(parent, bg=C_BG, padx=8, pady=8)
        f.grid(row=row, column=col, sticky="nsew", padx=3, pady=3)
        tk.Label(f, text=label, font=("Segoe UI", 8), fg=C_MUTED, bg=C_BG).pack(anchor="w")
        val = tk.Label(f, text=value, font=("Segoe UI", 16, "bold"), fg=color, bg=C_BG)
        val.pack(anchor="w")
        return val

    # -----------------------------------------------------------------------
    # Wallet placeholder helpers
    # -----------------------------------------------------------------------

    def _clear_placeholder(self, _event=None):
        if self.wallet_var.get() == "0x...":
            self.wallet_entry.delete(0, "end")
            self.wallet_entry.configure(fg=C_TEXT)

    def _restore_placeholder(self, _event=None):
        val = self.wallet_var.get().strip()
        if not val:
            self.wallet_entry.insert(0, "0x...")
            self.wallet_entry.configure(fg=C_MUTED)
        elif val.startswith("0x") and len(val) == 42:
            # Valid wallet — save it
            save_config({"wallet": val})

    # -----------------------------------------------------------------------
    # Logging
    # -----------------------------------------------------------------------

    def _log(self, level: str, msg: str):
        self._log_queue.put((level, msg))

    def _poll_log_queue(self):
        try:
            while True:
                level, msg = self._log_queue.get_nowait()
                self.log_text.configure(state="normal")
                ts = time.strftime("%H:%M:%S")
                icon = {"INFO": "·", "SUCCESS": "✓", "WARNING": "⚠",
                        "ERROR": "✗", "HEADER": "━"}.get(level, "·")
                self.log_text.insert("end", f"[{ts}] {icon} {msg}\n", level)
                self.log_text.see("end")
                self.log_text.configure(state="disabled")
        except queue.Empty:
            pass
        self.root.after(120, self._poll_log_queue)

    # -----------------------------------------------------------------------
    # Uptime ticker
    # -----------------------------------------------------------------------

    def _tick_uptime(self):
        if self._running and self._start_time:
            elapsed = int(time.time() - self._start_time)
            h, rem  = divmod(elapsed, 3600)
            m, s    = divmod(rem, 60)
            uptime_str = f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
            self._stat_uptime.configure(text=uptime_str)
            # tasks/hr
            if elapsed > 0:
                rate = self._tasks_completed / (elapsed / 3600)
                self._stat_rate.configure(text=f"{rate:.1f}")
            # Update status bar
            self._statusbar.update(
                tasks=f"{self._tasks_completed} done / {self._tasks_failed} failed",
                gwc=f"{self._gwc_earned:.2f}",
                uptime=uptime_str,
                latency=f"{self._latency_ms}ms" if self._latency_ms else "—",
            )
        self.root.after(1000, self._tick_uptime)

    # -----------------------------------------------------------------------
    # Auto-update check
    # -----------------------------------------------------------------------

    def _check_for_update(self):
        """Check GitHub for a newer release and prompt the user if one exists."""
        def _do_check():
            try:
                resp = requests.get(GITHUB_RELEASE_URL, timeout=8)
                if resp.status_code != 200:
                    return
                data = resp.json()
                latest_tag = data.get("tag_name", "").lstrip("v")
                if not latest_tag:
                    return
                def _ver(s):
                    try:
                        return tuple(int(x) for x in s.split("."))
                    except Exception:
                        return (0, 0, 0)
                if _ver(latest_tag) > _ver(APP_VERSION):
                    self.root.after(0, lambda: self._show_update_dialog(latest_tag))
            except Exception:
                pass
        threading.Thread(target=_do_check, daemon=True).start()

    def _show_update_dialog(self, latest_version: str):
        import webbrowser
        answer = messagebox.askyesno(
            "Update Available",
            f"A new version of the GreenWaveCoin Worker is available!\n\n"
            f"  Current version:  v{APP_VERSION}\n"
            f"  Latest version:   v{latest_version}\n\n"
            f"Download the latest version now?",
            icon="info",
        )
        if answer:
            webbrowser.open(DOWNLOAD_PAGE)

    # -----------------------------------------------------------------------
    # System tray
    # -----------------------------------------------------------------------

    def _minimize_to_tray(self):
        if not TRAY_AVAILABLE:
            return
        self.root.withdraw()

        def _create_icon_image():
            """Create a simple teal circle icon."""
            try:
                img = PILImage.new("RGBA", (64, 64), (0, 0, 0, 0))
                from PIL import ImageDraw
                draw = ImageDraw.Draw(img)
                draw.ellipse([4, 4, 60, 60], fill=(0, 229, 204, 255))
                return img
            except Exception:
                return PILImage.new("RGBA", (64, 64), (0, 229, 204, 255))

        def _restore(_icon, _item):
            _icon.stop()
            self._tray_icon = None
            self.root.after(0, self.root.deiconify)

        menu = pystray.Menu(
            pystray.MenuItem("Restore", _restore, default=True),
            pystray.MenuItem("Quit", lambda i, it: (i.stop(), self.root.after(0, self.root.destroy))),
        )
        self._tray_icon = pystray.Icon(
            "GreenWaveCoin Worker",
            _create_icon_image(),
            f"GreenWaveCoin Worker v{APP_VERSION}",
            menu,
        )
        threading.Thread(target=self._tray_icon.run, daemon=True).start()

    # -----------------------------------------------------------------------
    # Network ping
    # -----------------------------------------------------------------------

    def _ping_network(self):
        def _do_ping():
            try:
                t0 = time.time()
                r  = requests.get(f"{BACKEND_URL}/health", timeout=5)
                ms = int((time.time() - t0) * 1000)
                ok = r.status_code == 200
            except Exception:
                ok, ms = False, 0
            self._latency_ms = ms
            self.root.after(0, lambda: self._update_net_badge(ok, ms))
        threading.Thread(target=_do_ping, daemon=True).start()
        self.root.after(15000, self._ping_network)

    def _poll_network_stats(self):
        """Fetch global network stats from coordinator every 60 seconds."""
        def _do_fetch():
            try:
                r = requests.get(f"{BACKEND_URL}/api/ai/stats", timeout=8)
                if r.status_code == 200:
                    data    = r.json()
                    total   = data.get("totalTasksCompleted", data.get("totalResults", 0))
                    workers = data.get("uniqueWorkers", 0)
                    self.root.after(0, lambda: self._stat_network.configure(text=f"{total:,}"))
                    self.root.after(0, lambda: self._stat_workers.configure(text=str(workers)))
            except Exception:
                pass
        threading.Thread(target=_do_fetch, daemon=True).start()
        self.root.after(60_000, self._poll_network_stats)

    def _update_net_badge(self, ok: bool, ms: int):
        if ok:
            if ms < 150:
                color = C_SUCCESS
                label = f"⬤  Network OK  {ms}ms"
            elif ms < 400:
                color = C_WARN
                label = f"⬤  Network OK  {ms}ms"
            else:
                color = C_ERROR
                label = f"⬤  High latency  {ms}ms"
        else:
            color = C_ERROR
            label = "⬤  Network unreachable"
        self._net_lbl.configure(text=label, fg=color)
        self._statusbar.update(latency=f"{ms}ms" if ok else "offline")

    # -----------------------------------------------------------------------
    # Worker control
    # -----------------------------------------------------------------------

    def _validate_wallet(self, wallet: str) -> bool:
        w = wallet.strip()
        return w.startswith("0x") and len(w) == 42 and w != "0x..."

    def _start_worker(self):
        wallet = self.wallet_var.get().strip()
        if not self._validate_wallet(wallet):
            messagebox.showerror(
                "Invalid Wallet",
                "Please enter a valid Polygon wallet address.\n"
                "It must start with 0x and be 42 characters long.\n\n"
                "Example: 0xA90Aaf362b047481C4033Ec26b19264eAC2e94c4"
            )
            return

        # Save wallet for next session
        save_config({"wallet": wallet})

        self._running          = True
        self._tasks_completed  = 0
        self._tasks_failed     = 0
        self._gwc_earned       = 0.0
        self._start_time       = time.time()

        self.start_btn.configure(state="disabled", bg=C_BORDER, fg=C_MUTED)
        self.stop_btn.configure(state="normal", bg=C_ERROR, fg=C_BG, text="■  Stop")
        self.wallet_entry.configure(state="disabled")
        self._dot.set_state("connecting")
        self._status_lbl.configure(text="Connecting…", fg=C_WARN)
        self._progress_bar.reset()
        self._nn_canvas.set_state("connecting")
        self._statusbar.update_state("connecting")

        self._worker_thread = threading.Thread(
            target=self._worker_loop, args=(wallet,), daemon=True
        )
        self._worker_thread.start()

    def _stop_worker(self):
        self._running = False
        self.stop_btn.configure(state="disabled", text="■  Stopping…")
        self._log("WARNING", "Stop requested — finishing current task…")

    def _on_stopped(self):
        self.start_btn.configure(state="normal", bg=C_ACCENT, fg=C_BG)
        self.stop_btn.configure(state="disabled", bg=C_BORDER, fg=C_MUTED, text="■  Stop")
        self.wallet_entry.configure(state="normal")
        self._dot.set_state("stopped")
        self._status_lbl.configure(text="Stopped", fg=C_WARN)
        self._progress_bar.reset()
        self._task_id_lbl.configure(text="—  Stopped")
        self._epoch_lbl.configure(text="—")
        self._live_acc_lbl.configure(text="—")
        self._nn_canvas.set_state("stopped")
        self._statusbar.update_state("stopped")
        self._log("WARNING",
                  f"Worker stopped.  Completed: {self._tasks_completed}  "
                  f"Failed: {self._tasks_failed}  "
                  f"Est. GWC: {self._gwc_earned:.2f}")

    # -----------------------------------------------------------------------
    # Progress callback (called from worker thread)
    # -----------------------------------------------------------------------

    def _on_epoch(self, epoch: int, total: int, acc: float):
        self._current_acc = acc
        pct = epoch / total
        self.root.after(0, lambda: self._progress_bar.set_progress(pct))
        self.root.after(0, lambda: self._epoch_lbl.configure(text=f"{epoch} / {total}"))
        self.root.after(0, lambda: self._live_acc_lbl.configure(
            text=f"{acc:.2%}", fg=C_ACCENT))
        self.root.after(0, lambda: self._nn_canvas.set_metrics(acc, self._current_loss))
        self.root.after(0, lambda: self._statusbar.update(
            epoch=f"{epoch}/{total}",
            acc=f"{acc:.1%}",
        ))

    # -----------------------------------------------------------------------
    # Stats update (main thread)
    # -----------------------------------------------------------------------

    def _update_stats(self, acc: Optional[float] = None):
        self._stat_completed.configure(text=str(self._tasks_completed))
        self._stat_failed.configure(text=str(self._tasks_failed))
        self._stat_gwc.configure(text=f"{self._gwc_earned:.2f}")
        total = self._tasks_completed + self._tasks_failed
        if total > 0:
            sr = self._tasks_completed / total
            self._stat_success.configure(
                text=f"{sr:.0%}",
                fg=C_SUCCESS if sr >= 0.85 else C_WARN if sr >= 0.6 else C_ERROR
            )
        if acc is not None:
            self._chart.add_point(acc)

    # -----------------------------------------------------------------------
    # Worker loop (background thread)
    # -----------------------------------------------------------------------

    def _worker_loop(self, wallet: str):
        client = BackendClient(BACKEND_URL, wallet, api_key=WORKER_API_KEY,
                               max_retries=MAX_RETRIES)

        self._log("HEADER", "━" * 48)
        self._log("HEADER", f"  GreenWaveCoin AI Worker  v{APP_VERSION}  —  Starting")
        self._log("INFO",   f"  Wallet  : {wallet[:10]}…{wallet[-6:]}")
        self._log("INFO",   f"  Backend : {BACKEND_URL}")
        self._log("INFO",   f"  Compute : {'PyTorch' if TORCH_AVAILABLE else 'NumPy fallback'}")
        self._log("HEADER", "━" * 48)
        self._log("INFO",   "Connecting to coordinator…")

        # Wait for backend with exponential backoff
        backoff = 5
        while self._running:
            ok, ms = client.health_check()
            if ok:
                self.root.after(0, lambda: self._update_net_badge(True, ms))
                break
            self._log("WARNING", f"Coordinator unreachable, retrying in {backoff}s…")
            for _ in range(backoff):
                if not self._running:
                    self.root.after(0, self._on_stopped)
                    return
                time.sleep(1)
            backoff = min(backoff * 2, 60)

        if not self._running:
            self.root.after(0, self._on_stopped)
            return

        self._log("SUCCESS", "Connected to coordinator!  Fetching tasks…")
        self.root.after(0, lambda: self._dot.set_state("running"))
        self.root.after(0, lambda: self._status_lbl.configure(text="Running", fg=C_ACCENT))
        self.root.after(0, lambda: self._nn_canvas.set_state("running"))
        self.root.after(0, lambda: self._statusbar.update_state("running"))

        no_task_count = 0

        while self._running:
            try:
                task = client.fetch_task()

                if task is None:
                    no_task_count += 1
                    # Fetch queue length to give better feedback
                    queue_len = client.get_queue_length()
                    if queue_len == 0:
                        msg = f"Queue empty — new tasks generated every ~5 min  (wait #{no_task_count})"
                    else:
                        msg = f"No task assigned yet — queue has {queue_len} tasks  (wait #{no_task_count})"
                    self._log("INFO", msg)
                    self.root.after(0, lambda m=msg: self._task_id_lbl.configure(
                        text=f"⏳  {m[:50]}…" if len(msg) > 50 else f"⏳  {msg}"))
                    self.root.after(0, lambda: self._statusbar.update(
                        epoch="—", acc="—"))
                    for _ in range(POLL_INTERVAL):
                        if not self._running:
                            break
                        time.sleep(1)
                    continue

                no_task_count = 0
                task_id     = task["id"]
                raw_payload = task.get("payload", "{}")
                try:
                    config = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
                except json.JSONDecodeError:
                    self._log("WARNING", "Invalid task payload, skipping.")
                    time.sleep(5)
                    continue

                layers = config.get("layers", [])
                act    = config.get("activation", "relu")
                opt    = config.get("optimizer", "adam")
                lr     = config.get("learning_rate", 0.001)
                epochs = min(int(config.get("epochs", 5)), 10)

                short_id = task_id[:8] if len(task_id) >= 8 else task_id
                self._log("INFO", f"Task {short_id}…  layers={layers}  act={act}  opt={opt}  lr={lr}")

                self.root.after(0, lambda sid=short_id: self._task_id_lbl.configure(
                    text=f"🔬  Task {sid}…"))
                self.root.after(0, lambda l=layers, a=act: self._task_arch_lbl.configure(
                    text=f"Architecture: {l}  |  Activation: {a}"))
                self.root.after(0, lambda o=opt, r=lr: self._task_opt_lbl.configure(
                    text=f"Optimizer: {o}  |  LR: {r}"))
                self.root.after(0, lambda: self._progress_bar.reset())
                self.root.after(0, lambda e=epochs: self._epoch_lbl.configure(text=f"0 / {e}"))
                self.root.after(0, lambda: self._live_acc_lbl.configure(
                    text="Training…", fg=C_WARN))

                # Update neural net visualizer with actual architecture
                # Input=20 features, hidden=layers, output=4 classes
                viz_arch = [min(20, 8)] + [min(n, 12) for n in layers] + [4]
                self.root.after(0, lambda a=viz_arch: self._nn_canvas.set_architecture(a))

                try:
                    if TORCH_AVAILABLE:
                        metrics = train_and_evaluate(config, progress_cb=self._on_epoch)
                    else:
                        metrics = numpy_fallback_evaluate(config, progress_cb=self._on_epoch)
                except Exception as e:
                    self._log("ERROR", f"Training error: {e}")
                    self._tasks_failed += 1
                    self.root.after(0, self._update_stats)
                    time.sleep(5)
                    continue

                acc  = metrics.get("accuracy", 0)
                loss = metrics.get("final_loss", 0)
                t    = metrics.get("training_time_seconds", 0)
                self._current_acc  = acc
                self._current_loss = loss
                self._log("SUCCESS", f"✓ Task done  accuracy={acc:.2%}  time={t:.1f}s")
                self.root.after(0, lambda a=acc: self._live_acc_lbl.configure(
                    text=f"{a:.2%}", fg=C_SUCCESS))
                self.root.after(0, lambda: self._progress_bar.set_progress(1.0))
                self.root.after(0, lambda a=acc, l=loss: self._nn_canvas.set_metrics(a, l))
                self.root.after(0, lambda a=acc: self._statusbar.update(
                    acc=f"{a:.1%}", epoch="done"))

                success = client.submit_result(task_id, config, metrics)
                if success:
                    self._tasks_completed += 1
                    self._gwc_earned      += GWC_PER_TASK
                    self._log("SUCCESS",
                              f"✓ Result submitted!  Total: {self._tasks_completed}  "
                              f"Est. GWC: {self._gwc_earned:.2f}")
                    self.root.after(0, lambda a=acc: self._update_stats(a))
                else:
                    self._tasks_failed += 1
                    self._log("ERROR", "✗ Failed to submit result.")
                    self.root.after(0, lambda: self._update_stats())

            except Exception as e:
                self._log("ERROR", f"Unexpected error: {e}")
                time.sleep(POLL_INTERVAL)

        self.root.after(0, self._on_stopped)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    root = tk.Tk()
    try:
        if getattr(sys, "frozen", False):
            base = sys._MEIPASS
        else:
            base = os.path.dirname(__file__)
        icon_path = os.path.join(base, "gwc_icon.ico")
        if os.path.exists(icon_path):
            root.iconbitmap(icon_path)
    except Exception:
        pass

    app = GWCWorkerApp(root)

    def _on_close():
        if app._running:
            if TRAY_AVAILABLE:
                answer = messagebox.askyesnocancel(
                    "Worker Running",
                    "The worker is still running.\n\n"
                    "• Yes — Minimize to system tray (keep running)\n"
                    "• No — Stop worker and quit\n"
                    "• Cancel — Go back",
                )
                if answer is True:
                    app._minimize_to_tray()
                    return
                elif answer is False:
                    app._stop_worker()
                    root.after(1500, root.destroy)
                    return
                else:
                    return  # Cancel
            else:
                answer = messagebox.askyesno(
                    "Worker Running",
                    "The worker is still running. Stop it and quit?",
                )
                if answer:
                    app._stop_worker()
                    root.after(1500, root.destroy)
                return
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", _on_close)
    root.mainloop()


if __name__ == "__main__":
    main()
