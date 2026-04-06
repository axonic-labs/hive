import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { adminSpacesRouter } from './routes/admin-spaces.js';
import { adminUsersRouter } from './routes/admin-users.js';
import { adminAgentsRouter } from './routes/admin-agents.js';
import { dataRouter } from './routes/data.js';
import { auth } from './middleware/auth.js';
import { admin } from './middleware/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.text({ type: 'text/*' }));

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin/spaces', auth, admin, adminSpacesRouter);
  app.use('/api/admin/users', auth, admin, adminUsersRouter);
  app.use('/api/admin/agents', auth, admin, adminAgentsRouter);
  app.use('/api/data', auth, dataRouter);

  // Error handler for API routes
  app.use('/api', errorHandler);

  // Serve UI at root (after all /api routes)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: path.resolve(__dirname, '../../ui'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const uiDist = path.resolve(__dirname, '../../ui/dist');
    app.use(express.static(uiDist));
    app.get('*splat', (_req, res) => {
      res.sendFile(path.join(uiDist, 'index.html'));
    });
  }

  return app;
}
