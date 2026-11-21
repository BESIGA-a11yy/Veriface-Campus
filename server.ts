import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, isDatabaseReady } from './backend/config/db.ts';
import authRoutes from './backend/routes/auth.ts';
import adminRoutes from './backend/routes/admin.ts';
import courseRoutes from './backend/routes/courses.ts';
import attendanceRoutes from './backend/routes/attendance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isStandaloneApi = process.env.STANDALONE_API === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Initialize MongoDB Atlas connection and seed default System Admin
  await connectDatabase();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      dbConnected: isDatabaseReady(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/attendance', attendanceRoutes);

  if (!isStandaloneApi) {
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] VeriFace Campus running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
