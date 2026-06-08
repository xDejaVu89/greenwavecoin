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

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------

app.use(helmet());

// CORS — restrict to allowed origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Electron)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '64kb' }));

// ---------------------------------------------------------------------------
// Rate limiting — stricter limits for write endpoints
// ---------------------------------------------------------------------------

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const writeLimiter = rateLimit({
  windowMs: 60000,
  max: 30, // max 30 result submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Result submission rate limit exceeded.' },
});

app.use('/api/', generalLimiter);
app.use('/api/results', writeLimiter);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: 'GreenWaveCoin AI Research Network',
    version: process.env.npm_package_version || '1.0.0',
    ...taskService.getStats(),
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use('/api/rewards', rewardsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/results', resultsRouter);
app.use('/api/fah', fahRouter);
app.use('/api/ai', aiRouter);

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('[ERROR]', err.message);
  if (err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== 'test') {
  // Re-queue stuck tasks every 5 minutes
  setInterval(() => {
    const requeued = taskService.requeueStuckTasks();
    if (requeued > 0) {
      console.log(`[SCHEDULER] Re-queued ${requeued} stuck task(s)`);
    }
  }, 5 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`🚀 GreenWaveCoin coordinator running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Auth        : ${process.env.ADMIN_API_KEY ? 'enabled' : 'DISABLED (set ADMIN_API_KEY)'}`);
    console.log(`   Database    : ${process.env.DB_PATH || 'data/gwc.db'}`);
  });
}

export default app;
