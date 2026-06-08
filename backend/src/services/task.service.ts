import { randomUUID } from 'crypto';
import { stmts, deserializeResult } from '../db/database';

export interface Task {
  id: string;
  payload: string;
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
  hash: string;
  signature: string;
  receivedAt: number;
  validSignature: boolean;
  metrics?: AIMetrics;
  config?: Record<string, unknown>;
}

class TaskService {
  addTask(payload: string): Task {
    const task: Task = { id: randomUUID(), payload };
    stmts.insertTask.run({ id: task.id, payload: task.payload });
    return task;
  }

  getNextTask(): Task | null {
    const row = stmts.fetchNextTask.get() as any;
    if (!row) return null;
    return {
      id: row.id,
      payload: row.payload,
      assignedAt: row.assigned_at ? row.assigned_at * 1000 : undefined,
    };
  }

  getTask(id: string): Task | undefined {
    const row = stmts.getTaskById.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      payload: row.payload,
      assignedAt: row.assigned_at ? row.assigned_at * 1000 : undefined,
    };
  }

  addResult(result: TaskResult): void {
    stmts.insertResult.run({
      id: result.id,
      worker: result.worker,
      hash: result.hash,
      signature: result.signature,
      valid_signature: result.validSignature ? 1 : 0,
      metrics: result.metrics ? JSON.stringify(result.metrics) : null,
      config: result.config ? JSON.stringify(result.config) : null,
    });
    // Mark the task as completed so it leaves the queue
    stmts.markTaskCompleted.run(result.id);
  }

  getResults(): TaskResult[] {
    const rows = stmts.getAllResults.all() as any[];
    return rows.map(deserializeResult);
  }

  getResultsByWorker(wallet: string): TaskResult[] {
    const rows = stmts.getResultsByWorker.all(wallet.toLowerCase()) as any[];
    return rows.map(deserializeResult);
  }

  getQueueLength(): number {
    const row = stmts.getQueueLength.get() as any;
    return row?.count ?? 0;
  }

  /** Re-queue tasks stuck in 'assigned' for more than 10 minutes */
  requeueStuckTasks(): number {
    const info = stmts.requeueStuckTasks.run();
    return info.changes;
  }

  getStats() {
    const queueLength = this.getQueueLength();
    const totalResults = (stmts.getTotalResults.get() as any)?.count ?? 0;
    const validResults = (stmts.getValidResults.get() as any)?.count ?? 0;
    const uniqueWorkers = (stmts.getUniqueWorkers.get() as any)?.count ?? 0;
    return { queueLength, totalResults, validResults, uniqueWorkers };
  }
}

export const taskService = new TaskService();
