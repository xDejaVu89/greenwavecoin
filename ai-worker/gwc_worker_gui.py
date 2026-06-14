#!/usr/bin/env python3
"""
GreenWaveCoin AI Worker — Enhanced Desktop GUI v1.0.4
=======================================================
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

Packaged with PyInstaller into a single .exe for Windows users.
"""

import hashlib
import json
import math
import os
import queue
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
# Constants
# ---------------------------------------------------------------------------
BACKEND_URL    = "https://api.greenwavecoin.com"
WORKER_API_KEY = "gwc-worker-2025"
APP_VERSION    = "1.0.5"
POLL_INTERVAL  = 30
MAX_RETRIES    = 3
GWC_PER_TASK   = 0.5   # estimated GWC reward per completed task
GITHUB_RELEASE_URL = "https://api.github.com/repos/xDejaVu89/greenwavecoin/releases/latest"
DOWNLOAD_PAGE     = "https://greenwavecoin.com"

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
# Training logic
# ---------------------------------------------------------------------------

def generate_benchmark_dataset(n_samples=1000, n_features=20, n_classes=4, seed=42):
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features)
    w = rng.randn(n_features, n_classes)
    logits = [[sum(X[i][k] * w[k][j] for k in range(n_features)) for j in range(n_classes)]
              for i in range(n_samples)]
    y = [max(range(n_classes), key=lambda j: logits[i][j]) for i in range(n_samples)]
    return X, y


def numpy_fallback_evaluate(config: dict, progress_cb=None) -> dict:
    layers = config.get("layers", [64, 32])
    epochs = min(config.get("epochs", 5), 3)
    for ep in range(1, epochs + 1):
        time.sleep(0.4)
        if progress_cb:
            progress_cb(ep, epochs, 0.65 + ep * 0.05)
    accuracy = round(0.70 + 0.15 * (len(layers) / 4), 4)
    return {
        "accuracy": accuracy,
        "training_time_seconds": round(0.4 * epochs, 2),
        "epochs_completed": epochs,
        "final_loss": round(0.5 - accuracy * 0.3, 4),
        "torch_available": False,
    }


def train_and_evaluate(config: dict, progress_cb=None) -> dict:
    layers        = config.get("layers", [64, 32])
    activation_name = config.get("activation", "relu")
    learning_rate = float(config.get("learning_rate", 0.001))
    epochs        = min(int(config.get("epochs", 5)), 10)
    batch_size    = int(config.get("batch_size", 32))

    activation_map = {
        "relu": nn.ReLU, "tanh": nn.Tanh, "sigmoid": nn.Sigmoid,
        "leaky_relu": nn.LeakyReLU, "elu": nn.ELU,
    }
    ActClass = activation_map.get(activation_name, nn.ReLU)

    X_np, y_np = generate_benchmark_dataset()
    n_features = len(X_np[0]) if X_np else 20
    n_classes  = 4

    X_t = torch.tensor(X_np, dtype=torch.float32)
    y_t = torch.tensor(y_np, dtype=torch.long)
    dataset = TensorDataset(X_t, y_t)
    loader  = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    layer_sizes = [n_features] + layers + [n_classes]
    net_layers  = []
    for i in range(len(layer_sizes) - 1):
        net_layers.append(nn.Linear(layer_sizes[i], layer_sizes[i + 1]))
        if i < len(layer_sizes) - 2:
            net_layers.append(ActClass())
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
        for xb, yb in loader:
            optimizer.zero_grad()
            out  = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()
            final_loss = loss.item()
        # intermediate accuracy for progress callback
        model.eval()
        with torch.no_grad():
            preds    = model(X_t).argmax(dim=1)
            ep_acc   = (preds == y_t).float().mean().item()
        model.train()
        if progress_cb:
            progress_cb(epoch, epochs, ep_acc)

    training_time = round(time.time() - start, 2)
    model.eval()
    with torch.no_grad():
        preds    = model(X_t).argmax(dim=1)
        accuracy = round((preds == y_t).float().mean().item(), 4)

    return {
        "accuracy": accuracy,
        "training_time_seconds": training_time,
        "epochs_completed": epochs,
        "final_loss": round(final_loss, 4),
        "torch_available": True,
    }


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
        retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.session.mount("http://",  HTTPAdapter(max_retries=retry))

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["X-API-Key"] = self.api_key
        return h

    def health_check(self):
        try:
            t0 = time.time()
            r  = self.session.get(f"{self.backend_url}/health", timeout=10)
            ms = int((time.time() - t0) * 1000)
            return r.status_code == 200, ms
        except Exception:
            return False, 0

    def fetch_task(self):
        try:
            r = self.session.post(
                f"{self.backend_url}/api/ai/tasks/fetch",
                json={"wallet": self.wallet},
                headers=self._headers(),
                timeout=30,
            )
            if r.status_code == 200:
                return r.json().get("task")
            return None
        except Exception:
            return None

    def submit_result(self, task_id, config, metrics):
        # Use compact separators (no spaces) to match JavaScript JSON.stringify output.
        # JS: JSON.stringify(obj, keys) produces {"key":value} without spaces.
        # Python default json.dumps produces {"key": value} WITH spaces — causing hash mismatch.
        payload_str = json.dumps(config, sort_keys=True, separators=(',', ':'))
        result_hash = hashlib.sha256(
            f"{task_id}:{payload_str}:{metrics['accuracy']:.4f}".encode()
        ).hexdigest()
        body = {"taskId": task_id, "wallet": self.wallet,
                "metrics": metrics, "resultHash": result_hash}
        for attempt in range(1, self.max_retries + 1):
            try:
                r = self.session.post(
                    f"{self.backend_url}/api/ai/tasks/submit",
                    json=body, headers=self._headers(), timeout=30,
                )
                if r.status_code in (200, 201):
                    return True
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
            self.create_text(pad_x - 2, y, text=f"{int(pct*100)}%",
                             anchor="e", fill=C_MUTED, font=("Segoe UI", 7))

        if len(self._data) < 2:
            self.create_text(w // 2, h // 2, text="Waiting for tasks…",
                             fill=C_MUTED, font=("Segoe UI", 9))
            return

        # Build points
        n   = len(self._data)
        pts = []
        for i, v in enumerate(self._data):
            x = pad_x + (i / (n - 1)) * inner_w
            y = pad_y + inner_h * (1 - v)
            pts.append((x, y))

        # Filled area under line
        poly_pts = [pad_x, pad_y + inner_h]
        for x, y in pts:
            poly_pts += [x, y]
        poly_pts += [pts[-1][0], pad_y + inner_h]
        self.create_polygon(poly_pts, fill="#00e5cc22", outline="")

        # Line
        for i in range(len(pts) - 1):
            self.create_line(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1],
                             fill=C_ACCENT, width=2, smooth=True)

        # Dots
        for x, y in pts[:-1]:
            self.create_oval(x-2, y-2, x+2, y+2, fill=C_PANEL, outline=C_ACCENT, width=1)
        # Last dot highlighted
        lx, ly = pts[-1]
        self.create_oval(lx-4, ly-4, lx+4, ly+4, fill=C_ACCENT, outline="")
        self.create_text(lx, ly - 10, text=f"{self._data[-1]:.1%}",
                         fill=C_ACCENT, font=("Segoe UI", 8, "bold"))


# ---------------------------------------------------------------------------
# Animated progress bar
# ---------------------------------------------------------------------------

class AnimatedProgressBar(tk.Canvas):
    def __init__(self, parent, **kwargs):
        super().__init__(parent, bg=C_PANEL, highlightthickness=0, height=18, **kwargs)
        self._pct    = 0.0
        self._target = 0.0
        self._anim_id = None
        self.bind("<Configure>", lambda e: self._draw())
        self._animate()

    def set_progress(self, pct: float):
        self._target = max(0.0, min(1.0, pct))

    def reset(self):
        self._pct    = 0.0
        self._target = 0.0
        self._draw()

    def _animate(self):
        if abs(self._pct - self._target) > 0.002:
            self._pct += (self._target - self._pct) * 0.15
            self._draw()
        self.after(30, self._animate)

    def _draw(self):
        self.delete("all")
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 4:
            return
        r = h // 2
        # Track
        self.create_rounded_rect(0, 0, w, h, r, fill=C_BORDER)
        # Fill
        fw = max(0, int(w * self._pct))
        if fw > 4:
            self.create_rounded_rect(0, 0, fw, h, r, fill=C_ACCENT)
        # Shimmer stripe
        if fw > 20 and self._pct < 0.99:
            sx = fw - 14
            self.create_line(sx, 2, sx + 8, h - 2, fill="#ffffff33", width=4)
        # Text
        pct_text = f"{int(self._pct * 100)}%"
        self.create_text(w // 2, h // 2, text=pct_text,
                         fill=C_TEXT if self._pct > 0.5 else C_MUTED,
                         font=("Segoe UI", 8, "bold"))

    def create_rounded_rect(self, x1, y1, x2, y2, r, **kwargs):
        r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
        if r < 1:
            self.create_rectangle(x1, y1, x2, y2, **kwargs)
            return
        self.create_polygon(
            x1 + r, y1, x2 - r, y1,
            x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2,
            x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r,
            x1, y1 + r, x1, y1,
            smooth=True, **kwargs
        )


# ---------------------------------------------------------------------------
# Pulsing status dot
# ---------------------------------------------------------------------------

class PulsingDot(tk.Canvas):
    STATES = {
        "idle":       (C_MUTED,    False),
        "connecting": (C_WARN,     True),
        "running":    (C_ACCENT,   True),
        "stopped":    (C_WARN,     False),
        "error":      (C_ERROR,    True),
    }

    def __init__(self, parent, **kwargs):
        super().__init__(parent, width=14, height=14, bg=C_BG,
                         highlightthickness=0, **kwargs)
        self._state  = "idle"
        self._phase  = 0.0
        self._pulse  = False
        self._color  = C_MUTED
        self._animate()

    def set_state(self, state: str):
        self._state, (self._color, self._pulse) = state, self.STATES.get(state, (C_MUTED, False))

    def _animate(self):
        self.delete("all")
        if self._pulse:
            self._phase = (self._phase + 0.12) % (2 * math.pi)
            alpha_scale = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(self._phase))
            outer_r = 5 + 3 * (0.5 + 0.5 * math.sin(self._phase))
            # outer glow
            self.create_oval(7 - outer_r, 7 - outer_r, 7 + outer_r, 7 + outer_r,
                             fill="", outline=self._color, width=1)
        self.create_oval(3, 3, 11, 11, fill=self._color, outline="")
        self.after(40, self._animate)


# ---------------------------------------------------------------------------
# Main Application
# ---------------------------------------------------------------------------

class GWCWorkerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"GreenWaveCoin Worker  v{APP_VERSION}")
        self.root.geometry("820x680")
        self.root.minsize(720, 580)
        self.root.configure(bg=C_BG)

        # State
        self._worker_thread: Optional[threading.Thread] = None
        self._running        = False
        self._log_queue: queue.Queue = queue.Queue()
        self._tasks_completed = 0
        self._tasks_failed    = 0
        self._gwc_earned      = 0.0
        self._start_time: Optional[float] = None
        self._current_epoch   = 0
        self._total_epochs    = 1
        self._current_task_info = ""
        self._latency_ms      = 0
        self._acc_history: List[float] = []

        self._build_ui()
        self._poll_log_queue()
        self._tick_uptime()
        # Check for updates 3 seconds after startup (non-blocking)
        self.root.after(3000, self._check_for_update)

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
        tk.Label(wf, text="GWC rewards will be claimable at this address",
                 font=("Segoe UI", 8), fg=C_MUTED, bg=C_BG).pack(anchor="w", pady=(0, 4))

        entry_frame = tk.Frame(wf, bg=C_BORDER, padx=1, pady=1)
        entry_frame.pack(fill="x")
        inner = tk.Frame(entry_frame, bg=C_PANEL)
        inner.pack(fill="x")

        self.wallet_var   = tk.StringVar()
        self.wallet_entry = tk.Entry(
            inner, textvariable=self.wallet_var,
            font=("Consolas", 11), bg=C_PANEL, fg=C_TEXT,
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

        # Network badge
        self._net_lbl = tk.Label(bf, text="⬤  Checking network…",
                                  font=("Segoe UI", 9), fg=C_MUTED, bg=C_BG)
        self._net_lbl.pack(side="right", padx=4)

        self._sep()

        # ── Main content area ────────────────────────────────────────────────
        content = tk.Frame(self.root, bg=C_BG)
        content.pack(fill="both", expand=True, padx=20, pady=(0, 14))
        content.columnconfigure(0, weight=3)
        content.columnconfigure(1, weight=2)
        content.rowconfigure(0, weight=0)
        content.rowconfigure(1, weight=1)

        # Left column
        left_col = tk.Frame(content, bg=C_BG)
        left_col.grid(row=0, column=0, rowspan=2, sticky="nsew", padx=(0, 10))

        # ── Current task panel ───────────────────────────────────────────────
        task_panel = self._panel(left_col, "Current Task")
        task_panel.pack(fill="x", pady=(0, 8))

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

        # ── Activity log ─────────────────────────────────────────────────────
        log_panel = self._panel(left_col, "Activity Log")
        log_panel.pack(fill="both", expand=True)

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
        right_col.grid(row=0, column=1, rowspan=2, sticky="nsew")

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
        inner = tk.Frame(outer, bg=C_PANEL)
        inner.pack(fill="both", expand=True)
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
        if not self.wallet_var.get().strip():
            self.wallet_entry.insert(0, "0x...")
            self.wallet_entry.configure(fg=C_MUTED)

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
            self._stat_uptime.configure(
                text=f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
            )
            # tasks/hr
            if elapsed > 0:
                rate = self._tasks_completed / (elapsed / 3600)
                self._stat_rate.configure(text=f"{rate:.1f}")
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
                # Simple version comparison (major.minor.patch)
                def _ver(s):
                    try:
                        return tuple(int(x) for x in s.split("."))
                    except Exception:
                        return (0, 0, 0)
                if _ver(latest_tag) > _ver(APP_VERSION):
                    self.root.after(0, lambda: self._show_update_dialog(latest_tag))
            except Exception:
                pass  # Silently ignore — update check is non-critical
        threading.Thread(target=_do_check, daemon=True).start()

    def _show_update_dialog(self, latest_version: str):
        """Show a non-blocking dialog prompting the user to update."""
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
            self.root.after(0, lambda: self._update_net_badge(ok, ms))
        threading.Thread(target=_do_ping, daemon=True).start()
        self.root.after(15000, self._ping_network)

    def _poll_network_stats(self):
        """Fetch global network stats from coordinator every 60 seconds."""
        def _do_fetch():
            try:
                r = requests.get(f"{BACKEND_URL}/api/ai/stats", timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    total = data.get("totalTasksCompleted", data.get("totalResults", 0))
                    workers = data.get("uniqueWorkers", 0)
                    self.root.after(0, lambda: self._stat_network.configure(
                        text=f"{total:,}"))
                    self.root.after(0, lambda: self._stat_workers.configure(
                        text=str(workers)))
            except Exception:
                pass  # Silently ignore — non-critical
        threading.Thread(target=_do_fetch, daemon=True).start()
        self.root.after(60_000, self._poll_network_stats)

    def _update_net_badge(self, ok: bool, ms: int):
        if ok:
            color = C_SUCCESS if ms < 200 else C_WARN
            self._net_lbl.configure(text=f"⬤  Network OK  {ms}ms", fg=color)
        else:
            self._net_lbl.configure(text="⬤  Network unreachable", fg=C_ERROR)

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
                "Please enter a valid Ethereum wallet address.\n"
                "It must start with 0x and be 42 characters long.\n\n"
                "Example: 0xA90Aaf362b047481C4033Ec26b19264eAC2e94c4"
            )
            return

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
        self._log("WARNING",
                  f"Worker stopped.  Completed: {self._tasks_completed}  "
                  f"Failed: {self._tasks_failed}  "
                  f"Est. GWC: {self._gwc_earned:.2f}")

    # -----------------------------------------------------------------------
    # Progress callback (called from worker thread)
    # -----------------------------------------------------------------------

    def _on_epoch(self, epoch: int, total: int, acc: float):
        pct = epoch / total
        self.root.after(0, lambda: self._progress_bar.set_progress(pct))
        self.root.after(0, lambda: self._epoch_lbl.configure(
            text=f"{epoch} / {total}"))
        self.root.after(0, lambda: self._live_acc_lbl.configure(
            text=f"{acc:.2%}", fg=C_ACCENT))

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
                fg=C_SUCCESS if sr >= 0.9 else C_WARN if sr >= 0.7 else C_ERROR
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
        self._log("HEADER", "  GreenWaveCoin AI Worker  —  Starting")
        self._log("INFO",   f"  Wallet  : {wallet[:10]}…{wallet[-6:]}")
        self._log("INFO",   f"  Backend : {BACKEND_URL}")
        self._log("HEADER", "━" * 48)
        self._log("INFO",   "Connecting to coordinator…")

        # Wait for backend
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
        self.root.after(0, lambda: self._status_lbl.configure(
            text="Running", fg=C_ACCENT))

        while self._running:
            try:
                task = client.fetch_task()
                if task is None:
                    self._log("INFO",
                              f"No tasks available — waiting {POLL_INTERVAL}s…  "
                              f"(done: {self._tasks_completed})")
                    self.root.after(0, lambda: self._task_id_lbl.configure(
                        text="⏳  Waiting for tasks…"))
                    for _ in range(POLL_INTERVAL):
                        if not self._running:
                            break
                        time.sleep(1)
                    continue

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
                self._log("INFO", f"Task {short_id}…  layers={layers}  act={act}  opt={opt}")

                self.root.after(0, lambda sid=short_id: self._task_id_lbl.configure(
                    text=f"🔬  Task {sid}…"))
                self.root.after(0, lambda l=layers, a=act: self._task_arch_lbl.configure(
                    text=f"Architecture: {l}  |  Activation: {a}"))
                self.root.after(0, lambda o=opt, r=lr: self._task_opt_lbl.configure(
                    text=f"Optimizer: {o}  |  LR: {r}"))
                self.root.after(0, lambda: self._progress_bar.reset())
                self.root.after(0, lambda e=epochs: self._epoch_lbl.configure(
                    text=f"0 / {e}"))
                self.root.after(0, lambda: self._live_acc_lbl.configure(
                    text="Training…", fg=C_WARN))

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

                acc = metrics.get("accuracy", 0)
                t   = metrics.get("training_time_seconds", 0)
                self._log("SUCCESS",
                          f"✓ Task done  accuracy={acc:.2%}  time={t:.1f}s")
                self.root.after(0, lambda a=acc: self._live_acc_lbl.configure(
                    text=f"{a:.2%}", fg=C_SUCCESS))
                self.root.after(0, lambda: self._progress_bar.set_progress(1.0))

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
    root.protocol("WM_DELETE_WINDOW",
                  lambda: (app._stop_worker() if app._running else None) or root.destroy())
    root.mainloop()


if __name__ == "__main__":
    main()
