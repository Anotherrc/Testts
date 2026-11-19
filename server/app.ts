import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/media', express.static(path.resolve(process.cwd(), 'media')));

  app.use('/api', apiRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ detail: 'Endpoint no encontrado.' });
  });

  return app;
}
