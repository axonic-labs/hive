import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { adminSpacesRouter } from './routes/admin-spaces.js';
import { adminUsersRouter } from './routes/admin-users.js';
import { dataRouter } from './routes/data.js';
import { auth } from './middleware/auth.js';
import { admin } from './middleware/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');

function baseUrl(req: express.Request): string {
  const fwd = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()) || req.protocol;
  const host = req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

export async function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.text({ type: 'text/*' }));

  // ── Discovery (before SPA catch-all) ─────────────────

  app.get('/robots.txt', (req, res) => {
    const base = baseUrl(req);
    res.type('text/plain').send(
`User-agent: *
Allow: /

# Agent discovery
# LLM agent guide: ${base}/llms.txt
# API docs: ${base}/openapi.yaml
# Machine-readable discovery: ${base}/.well-known/hive
`);
  });

  app.get('/llms.txt', (req, res) => {
    const base = baseUrl(req);
    res.type('text/plain').send(
`# Hive — Personal Cloud

> Hive is a personal cloud API. Agents get scoped access to files organized in spaces.

## Authentication
All requests require \`Authorization: Bearer <api_key>\` header.
Verify your key: POST ${base}/api/auth/verify

## API Base
${base}/api

## Endpoints

### Files (permission-scoped)
- GET  /api/data/{space}/files           — List files (?prefix= to filter by folder)
- POST /api/data/{space}/files           — Create file { path, filename, content }
- GET  /api/data/{space}/files/{path}    — Read file (returns text/plain)
- PUT  /api/data/{space}/files/{path}    — Overwrite file (text/plain body)
- PATCH /api/data/{space}/files/{path}   — Append to file { content } (auto-newline, creates if missing)
- DELETE /api/data/{space}/files/{path}  — Delete file
- GET  /api/data/{space}/search?q=       — Full-text search

### Folders
- DELETE /api/data/{space}/folders/{path} — Delete folder and all contents

## Errors
JSON: { "error": "message", "status": 404 }
401 = bad key, 403 = no permission, 404 = not found

## Full Documentation
- OpenAPI spec: ${base}/openapi.yaml
- Agent guide: ${base}/agents.md
- Discovery: ${base}/.well-known/hive
`);
  });

  app.get('/.well-known/hive', (req, res) => {
    const base = baseUrl(req);
    res.json({
      version: '0.1.0',
      api: `${base}/api`,
      docs: {
        agents: `${base}/agents.md`,
        llms_txt: `${base}/llms.txt`,
        openapi: `${base}/openapi.yaml`,
      },
      auth: {
        type: 'bearer',
        verify: `${base}/api/auth/verify`,
      },
    });
  });

  // Serve repo-root docs
  app.get('/agents.md', (_req, res) => {
    res.type('text/markdown').sendFile(path.join(repoRoot, 'AGENTS.md'), (err) => {
      if (err) res.status(404).json({ error: 'Not found', status: 404 });
    });
  });

  app.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').sendFile(path.join(repoRoot, 'openapi.yaml'), (err) => {
      if (err) res.status(404).json({ error: 'Not found', status: 404 });
    });
  });

  // ── API Routes ───────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/admin/spaces', auth, admin, adminSpacesRouter);
  app.use('/api/admin/users', auth, admin, adminUsersRouter);
  app.use('/api/data', auth, dataRouter);

  app.use('/api', errorHandler);

  // ── UI (SPA catch-all, must be last) ─────────────────
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
