/**
 * GreenWaveCoin — Input Validation Middleware
 * =============================================
 * Validates and sanitizes incoming request bodies to prevent
 * malformed data from reaching the database or business logic.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Validate POST /api/tasks/create
 */
export declare function validateCreateTask(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Validate POST /api/results
 */
export declare function validateSubmitResult(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Validate GET /api/ai/leaderboard and similar wallet-param routes
 */
export declare function validateWalletParam(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=validate.d.ts.map