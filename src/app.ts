import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
