import express, { Application, Request, Response } from 'express';
import rewardsRouter from './routes/rewards.routes';
import { tasksRouter } from './routes/tasks.routes';
import { resultsRouter } from './routes/results.routes';
import fahRouter from './routes/fah.routes';
import aiRouter from './routes/ai.routes';
import { taskService } from './services/task.service';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check — includes queue and network stats
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: 'GreenWaveCoin AI Research Network',
    ...taskService.getStats(),
  });
});

// API routes
app.use('/api/rewards', rewardsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/results', resultsRouter);
app.use('/api/fah', fahRouter);
app.use('/api/ai', aiRouter);

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend coordinator running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

export default app;
