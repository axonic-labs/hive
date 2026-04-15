# Setup Documentation & Railway Deploy Template

**Date:** 2026-04-15
**Status:** Approved

## Goal

Create concise setup instructions so anyone can deploy their own Hive instance or run it locally. Primary deploy path is Railway with a one-click button; local dev works with zero external dependencies (git-based file storage).

## Target Audience

Self-hosters and developers. The README covers both "deploy your own" and "run locally."

## Files to Create

### 1. `README.md` (root)

Concise project README with these sections:

1. **Header** -- "Hive -- Personal Cloud" + 2-3 sentence description (your domain = your identity = your cloud)
2. **Deploy to Railway** -- Deploy button (image link to Railway template URL) + one-line instruction ("Set ADMIN_API_KEY, done. Spaces default to git-based storage.")
3. **Run Locally** -- git clone, pnpm install, pnpm build shared, set env vars, pnpm dev. 4-5 lines max.
4. **Configuration** -- Table of env vars (ADMIN_API_KEY, DATA_DIR, PORT, NODE_ENV). Brief note about optional Supabase Postgres per-space.
5. **What You Get** -- Bullet list: spaces, files/folders, users + API keys, agent REST API. Links to openapi.yaml and AGENTS.md.
6. **Contributing** -- Link to CLAUDE.md for dev workflow. pnpm, feature branches to develop.

No architecture diagrams, no deep dives. Keep it short.

### 2. `railway.toml` (root)

```toml
[build]
buildCommand = "pnpm install && pnpm run build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/auth/verify"

[[mounts]]
mountPath = "/data"
```

- Health check on `/api/auth/verify` (lightweight, confirms server up)
- Volume at `/data` persists config + git-backed file content across deploys
- Railway auto-detects Node.js via pnpm lockfile

### 3. `.env.example` (root)

```env
# Required: API key for the admin user (set this to any secure string)
ADMIN_API_KEY=

# Optional: where config/data is stored (default: /data in production, ./data locally)
# DATA_DIR=/data

# Optional: server port (default: 3000)
# PORT=3000
```

Only `ADMIN_API_KEY` is required. Everything else has sensible defaults.

## Design Decisions

- **No Dockerfile** -- Railway's native Node.js buildpack works fine. Can add later if demand exists.
- **No docker-compose** -- Overkill for quick start; git backend means zero external deps locally.
- **Volume at /data** -- Essential for persistence. Config, auth, and git-backed file content all live here. Without it, redeploys wipe state.
- **Minimal env vars** -- Only ADMIN_API_KEY required. Postgres/Supabase is optional, configured per-space after deploy.
- **Git-based storage as default** -- Parallel work adding filesystem/git backend means no database needed to get started.

## Out of Scope

- Dockerfile / container-based deployment
- Docker Compose for local development
- Detailed architecture documentation (CLAUDE.md covers this for contributors)
- CI/CD pipeline setup
