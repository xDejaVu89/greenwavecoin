#!/usr/bin/env python3
"""
GreenWaveCoin AI Task Generator
=================================
Generates Neural Architecture Search (NAS) tasks and seeds them into the
backend coordinator. The evolution engine uses results from completed tasks
to guide the next generation of configurations.

This script can be run:
  - Once to seed an initial population
  - Periodically (e.g., via cron) to replenish the task queue
  - As a continuous evolution loop (--evolve mode)

Usage:
    python3 task_generator.py --backend http://localhost:3000 --count 20
    python3 task_generator.py --backend http://localhost:3000 --evolve
"""

import argparse
import json
import logging
import os
import random
import sys
import time

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("gwc-generator")


# ---------------------------------------------------------------------------
# Configuration search space
# ---------------------------------------------------------------------------

SEARCH_SPACE = {
    "layers": [
        [16],
        [32],
        [64],
        [128],
        [32, 16],
        [64, 32],
        [128, 64],
        [64, 64],
        [128, 64, 32],
        [256, 128, 64],
        [64, 32, 16],
        [32, 32, 32],
    ],
    "activation": ["relu", "tanh", "leaky_relu", "elu"],
    "dropout": [0.0, 0.1, 0.2, 0.3, 0.5],
    "learning_rate": [0.1, 0.01, 0.001, 0.0001],
    "batch_size": [16, 32, 64, 128],
    "epochs": [5, 10, 15, 20],
}

FIXED_PARAMS = {
    "input_size": 20,
    "output_size": 4,
    "dataset_seed": 42,
}


def random_config() -> dict:
    """Sample a random configuration from the search space."""
    config = {
        "layers": random.choice(SEARCH_SPACE["layers"]),
        "activation": random.choice(SEARCH_SPACE["activation"]),
        "dropout": random.choice(SEARCH_SPACE["dropout"]),
        "learning_rate": random.choice(SEARCH_SPACE["learning_rate"]),
        "batch_size": random.choice(SEARCH_SPACE["batch_size"]),
        "epochs": random.choice(SEARCH_SPACE["epochs"]),
    }
    config.update(FIXED_PARAMS)
    return config


def mutate_config(base: dict, mutation_rate: float = 0.3) -> dict:
    """
    Produce a child config by mutating a parent.
    Each hyperparameter is independently mutated with probability `mutation_rate`.
    """
    child = base.copy()
    if random.random() < mutation_rate:
        child["layers"] = random.choice(SEARCH_SPACE["layers"])
    if random.random() < mutation_rate:
        child["activation"] = random.choice(SEARCH_SPACE["activation"])
    if random.random() < mutation_rate:
        child["dropout"] = random.choice(SEARCH_SPACE["dropout"])
    if random.random() < mutation_rate:
        child["learning_rate"] = random.choice(SEARCH_SPACE["learning_rate"])
    if random.random() < mutation_rate:
        child["batch_size"] = random.choice(SEARCH_SPACE["batch_size"])
    if random.random() < mutation_rate:
        child["epochs"] = random.choice(SEARCH_SPACE["epochs"])
    child.update(FIXED_PARAMS)
    return child


def crossover_configs(parent_a: dict, parent_b: dict) -> dict:
    """
    Produce a child config by crossing over two parents.
    Each hyperparameter is taken from one parent at random.
    """
    child = {}
    for key in ["layers", "activation", "dropout", "learning_rate", "batch_size", "epochs"]:
        child[key] = parent_a[key] if random.random() < 0.5 else parent_b[key]
    child.update(FIXED_PARAMS)
    return child


# ---------------------------------------------------------------------------
# Backend API client
# ---------------------------------------------------------------------------

class GeneratorClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def health_check(self) -> bool:
        try:
            r = self.session.get(f"{self.base_url}/health", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def create_task(self, config: dict) -> dict:
        r = self.session.post(
            f"{self.base_url}/api/tasks/create",
            json={"payload": json.dumps(config)},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()

    def get_results(self) -> list:
        r = self.session.get(f"{self.base_url}/api/results", timeout=10)
        r.raise_for_status()
        return r.json().get("results", [])

    def get_leaderboard(self) -> list:
        try:
            r = self.session.get(f"{self.base_url}/api/ai/leaderboard", timeout=10)
            r.raise_for_status()
            return r.json().get("leaderboard", [])
        except Exception:
            return []


# ---------------------------------------------------------------------------
# Evolution engine
# ---------------------------------------------------------------------------

def extract_top_configs(results: list, top_n: int = 5) -> list:
    """
    Parse completed results and return the top-N configs by accuracy.
    """
    scored = []
    for r in results:
        if not r.get("validSignature", True):
            continue
        metrics = r.get("metrics", {})
        config = r.get("config", {})
        accuracy = metrics.get("accuracy", 0.0)
        if config and accuracy > 0:
            scored.append((accuracy, config))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [cfg for _, cfg in scored[:top_n]]


def generate_next_generation(top_configs: list, gen_size: int = 20) -> list:
    """
    Generate the next generation of configs using:
    - Elitism: keep the top configs unchanged
    - Mutation: mutate top configs
    - Crossover: cross top configs with each other
    - Random: inject fresh random configs for diversity
    """
    next_gen = []

    if not top_configs:
        # Cold start — pure random
        return [random_config() for _ in range(gen_size)]

    # Elitism: keep top configs
    elite_count = min(3, len(top_configs))
    next_gen.extend(top_configs[:elite_count])

    # Mutation
    while len(next_gen) < gen_size * 0.6:
        parent = random.choice(top_configs)
        next_gen.append(mutate_config(parent))

    # Crossover
    while len(next_gen) < gen_size * 0.8:
        if len(top_configs) >= 2:
            a, b = random.sample(top_configs, 2)
            next_gen.append(crossover_configs(a, b))
        else:
            next_gen.append(mutate_config(top_configs[0]))

    # Random injection for diversity
    while len(next_gen) < gen_size:
        next_gen.append(random_config())

    return next_gen[:gen_size]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def seed_initial_population(client: GeneratorClient, count: int):
    log.info(f"Seeding {count} random tasks into the queue...")
    for i in range(count):
        config = random_config()
        result = client.create_task(config)
        task_id = result.get("task", {}).get("id", "?")
        log.info(f"  [{i+1}/{count}] Task {task_id} — {json.dumps(config)}")
    log.info("Initial population seeded.")


def evolve_loop(client: GeneratorClient, gen_size: int, gen_interval: int):
    """
    Continuous evolution loop:
    1. Wait for results to accumulate
    2. Extract top performers
    3. Generate next generation
    4. Seed new tasks
    5. Repeat
    """
    generation = 0
    log.info("Starting evolution loop...")

    while True:
        generation += 1
        log.info(f"\n=== Generation {generation} ===")

        results = client.get_results()
        log.info(f"Total results so far: {len(results)}")

        top_configs = extract_top_configs(results, top_n=5)
        if top_configs:
            log.info(f"Top configs found: {len(top_configs)}")
        else:
            log.info("No valid results yet — generating random population.")

        next_gen = generate_next_generation(top_configs, gen_size=gen_size)
        log.info(f"Seeding {len(next_gen)} tasks for generation {generation}...")

        for i, config in enumerate(next_gen):
            try:
                result = client.create_task(config)
                task_id = result.get("task", {}).get("id", "?")
                log.info(f"  [{i+1}/{len(next_gen)}] Task {task_id}")
            except Exception as e:
                log.warning(f"  Failed to create task: {e}")

        log.info(f"Generation {generation} seeded. Waiting {gen_interval}s for workers...")
        time.sleep(gen_interval)


def main():
    parser = argparse.ArgumentParser(description="GreenWaveCoin AI Task Generator")
    parser.add_argument(
        "--backend",
        default=os.environ.get("BACKEND_BASE_URL", "http://localhost:3000"),
        help="Backend coordinator base URL",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=20,
        help="Number of tasks to seed (for initial seeding mode)",
    )
    parser.add_argument(
        "--evolve",
        action="store_true",
        help="Run in continuous evolution mode",
    )
    parser.add_argument(
        "--gen-size",
        type=int,
        default=20,
        help="Tasks per generation (evolve mode)",
    )
    parser.add_argument(
        "--gen-interval",
        type=int,
        default=300,
        help="Seconds to wait between generations (evolve mode)",
    )
    args = parser.parse_args()

    client = GeneratorClient(args.backend)

    if not client.health_check():
        log.error(f"Backend not reachable at {args.backend}. Is it running?")
        sys.exit(1)

    if args.evolve:
        evolve_loop(client, args.gen_size, args.gen_interval)
    else:
        seed_initial_population(client, args.count)


if __name__ == "__main__":
    main()
