/**
 * GreenWaveCoin — API Key Authentication Middleware
 * ===================================================
 * Protects admin and task-creation endpoints with a shared API key.
 *
 * Usage:
 *   - Set ADMIN_API_KEY in .env for admin routes
 *   - Set WORKER_API_KEY in .env for worker routes (task fetch / result submit)
 *   - Public routes (leaderboard, stats, best-configs) require no key
 *
 * Clients pass the key in the Authorization header:
 *   Authorization: Bearer <key>
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Middleware: require a valid ADMIN_API_KEY.
 * Used for task creation (seeding), result listing, and verify endpoints.
 */
export declare function requireAdminKey(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/**
 * Middleware: require a valid WORKER_API_KEY.
 * Used for task fetch and result submission endpoints.
 */
export declare function requireWorkerKey(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map