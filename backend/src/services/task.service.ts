import { randomUUID } from 'crypto';

export interface Task {
  id: string;
  payload: string; // opaque payload (JSON string or base64)
  assignedAt?: number;
}

export interface AIMetrics {
  accuracy: number;
  final_loss: number;
  training_time_seconds: number;
  param_count: number;
  epochs_completed: number;
  mode?: string;
}

export interface TaskResult {
  id: string;
  worker: string;
  hash: string; // 0x-prefixed hex of blake3 or sha256 hash
  signature: string; // 0x-prefixed signature
  receivedAt: number;
  validSignature: boolean;
  // Extended AI fields (optional, populated by AI workers)
  metrics?: AIMetrics;
  config?: Record<string, unknown>;
}

class TaskService {
  private queue: Task[] = [];
  private results: TaskResult[] = [];
  private byId: Map<string, Task> = new Map();

  addTask(payload: string): Task {
    const task: Task = { id: randomUUID(), payload };
    this.queue.push(task);
    this.byId.set(task.id, task);
    return task;
  }

  getNextTask(): Task | null {
    const task = this.queue.shift() || null;
    if (task) task.assignedAt = Date.now();
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.byId.get(id);
  }

  addResult(result: TaskResult) {
    this.results.push(result);
  }

  getResults(): TaskResult[] {
    return this.results.slice();
  }

  /** Returns the queue length (useful for monitoring) */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Returns aggregate stats for the /health endpoint */
  getStats() {
    const valid = this.results.filter(r => r.validSignature !== false);
    const uniqueWorkers = new Set(this.results.map(r => r.worker?.toLowerCase()).filter(Boolean));
    return {
      queueLength: this.queue.length,
      totalResults: this.results.length,
      validResults: valid.length,
      uniqueWorkers: uniqueWorkers.size,
    };
  }
}

export const taskService = new TaskService();
