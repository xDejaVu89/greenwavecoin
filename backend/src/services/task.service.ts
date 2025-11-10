import { randomUUID } from 'crypto';

export interface Task {
  id: string;
  payload: string; // opaque payload (JSON string or base64)
  assignedAt?: number;
}

export interface TaskResult {
  id: string;
  worker: string;
  hash: string; // 0x-prefixed hex of blake3 hash
  signature: string; // 0x-prefixed signature
  receivedAt: number;
  validSignature: boolean;
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
}

export const taskService = new TaskService();
