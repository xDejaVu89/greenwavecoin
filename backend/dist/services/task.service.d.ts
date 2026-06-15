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
declare class TaskService {
    addTask(payload: string): Task;
    getNextTask(): Task | null;
    getTask(id: string): Task | undefined;
    addResult(result: TaskResult): void;
    getResults(): TaskResult[];
    getResultsByWorker(wallet: string): TaskResult[];
    getQueueLength(): number;
    /** Re-queue tasks stuck in 'assigned' for more than 10 minutes */
    requeueStuckTasks(): number;
    getStats(): {
        queueLength: number;
        totalResults: any;
        validResults: any;
        uniqueWorkers: any;
    };
}
export declare const taskService: TaskService;
export {};
//# sourceMappingURL=task.service.d.ts.map