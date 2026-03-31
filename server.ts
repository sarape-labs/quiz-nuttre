import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './server/db.ts';
import authRoutes from './server/routes/auth.ts';
import quizRoutes from './server/routes/quizzes.ts';
import publicRoutes from './server/routes/public.ts';
import uploadRoutes from './server/routes/upload.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', true);
  app.use(express.json());
  app.use(cookieParser());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.cookies.token) {
      console.log('Token cookie present');
    } else {
      console.log('No token cookie found');
    }
    next();
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/upload', uploadRoutes);

  // Serve uploaded files
  app.use('/uploads', express.static('/data/uploads'));

  // Check if we are in production (Fly.io sets FLY_APP_NAME)
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;

  // Vite middleware for development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
