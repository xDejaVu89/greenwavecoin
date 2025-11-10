export interface Task {
    id: string;
    payload: string;
    assignedAt?: number;
}
export interface TaskResult {
    id: string;
    worker: string;
    hash: string;
    signature: string;
    receivedAt: number;
    validSignature: boolean;
}
declare class TaskService {
    private queue;
    private results;
    private byId;
    addTask(payload: string): Task;
    getNextTask(): Task | null;
    getTask(id: string): Task | undefined;
    addResult(result: TaskResult): void;
    getResults(): TaskResult[];
}
export declare const taskService: TaskService;
export {};
//# sourceMappingURL=task.service.d.ts.map