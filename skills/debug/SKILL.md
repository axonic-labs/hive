---
name: debug
description: Debug Hive production issues using Railway CLI, Supabase Postgres, and the Hive API
argument-hint: "[issue description or check area]"
---

# Hive Production Debug Skill

You are a production debugging assistant for the **hive** project deployed on Railway.

> **IMPORTANT — Credential Setup:**
> 1. Read `skills/debug/secrets.md` to load credentials.
> 2. In every Bash call that needs secrets, assign them as **single-quoted** variables at the top, then use `$VARIABLE` references. Single quotes prevent shell interpretation of special characters in tokens. Example:
> ```bash
> ADMIN_API_KEY='I3U8fG...'
> HIVE_URL='https://hive.yaneq.com'
> curl -s "$HIVE_URL/api/auth/verify" -H "Authorization: Bearer $ADMIN_API_KEY"
> ```
> **CRITICAL:** Never inline long secret values directly into curl flags. Always use `$VARIABLE` references. Shell state does not persist between Bash calls, so you must re-set variables in every Bash call that needs them, or chain commands in a single call.

## Table of Contents
1. [Infrastructure Access](#1-infrastructure-access) — Railway CLI, Supabase DB, Hive API
2. [Railway Details](#2-railway-details) — Project/service IDs, volume
3. [Hive API](#3-hive-api) — REST endpoint index
4. [Database Access](#4-database-access) — Supabase Postgres queries
5. [Debugging Workflow](#5-debugging-workflow) — Step-by-step approach
6. [Common Issues](#6-common-issues) — Known problem patterns
7. [Instructions](#7-instructions) — Operational guidelines

---

## 1. Infrastructure Access

### Railway CLI
Railway CLI is installed and linked to the hive project. No token needed — use `railway` directly.

```bash
# Check service status
railway status

# View deployment logs
railway logs -d --lines 50

# View runtime logs
railway logs --lines 50

# View build logs
railway logs -b --lines 50

# View HTTP logs
railway logs --http --lines 20

# View errors only
railway logs --lines 50 --filter "@level:error"

# View env vars
railway variables

# Stream live logs
railway logs
```

### Supabase Postgres
- **Connection:** `SUPABASE_DB_URL` (from secrets.md)
- **Usage:** `psql "$SUPABASE_DB_URL" -c "QUERY"`
- Add `--csv` for machine-readable output, or `-x` for expanded display
- This is the database where Hive stores file content (one table per space, named `hive_{spacename}`)

### Hive API
- **Base URL:** `HIVE_URL` (from secrets.md)
- **Auth:** `Authorization: Bearer ADMIN_API_KEY`

---

## 2. Railway Details

| Property | Value |
|----------|-------|
| Project | hive |
| Project ID | ba5cf3c4-c697-4291-9c9f-b0b27ac046c2 |
| Service | hive |
| Service ID | 62cda2b2-c850-4298-8e1d-413337bc2dfd |
| Environment | production |
| Environment ID | f405f615-79a1-43fc-b39a-de4ed504b461 |
| Volume | hive-volume (mounted at /data) |
| Domains | hive.yaneq.com, hive-production-e724.up.railway.app |

---

## 3. Hive API

### Auth (all users)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/verify | Verify API key, return user info |

### Admin (/api/admin/*)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/spaces | List spaces |
| POST | /api/admin/spaces | Create space `{ name, type, database_url }` |
| DELETE | /api/admin/spaces/:space | Delete space |
| GET | /api/admin/users | List users (keys omitted) |
| POST | /api/admin/users | Create user `{ name }` → returns API key once |
| GET | /api/admin/users/:id | User detail |
| DELETE | /api/admin/users/:id | Delete user |
| GET | /api/admin/spaces/:space/permissions | Get permissions |
| PUT | /api/admin/spaces/:space/permissions | Update permissions |

### Data (/api/data/:space/*)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/data/:space/files | List files (?prefix=) |
| POST | /api/data/:space/files | Create file `{ path, filename, content }` |
| GET | /api/data/:space/files/*path | Read file |
| PUT | /api/data/:space/files/*path | Write file |
| PATCH | /api/data/:space/files/*path | Append to file `{ content }` |
| DELETE | /api/data/:space/files/*path | Delete file |
| GET | /api/data/:space/search?q= | Full-text search |

### Quick API Checks
```bash
# Verify server is up and auth works
curl -s "$HIVE_URL/api/auth/verify" -H "Authorization: Bearer $ADMIN_API_KEY"

# List spaces
curl -s "$HIVE_URL/api/admin/spaces" -H "Authorization: Bearer $ADMIN_API_KEY"

# List users
curl -s "$HIVE_URL/api/admin/users" -H "Authorization: Bearer $ADMIN_API_KEY"

# List files in a space
curl -s "$HIVE_URL/api/data/SPACE_NAME/files" -H "Authorization: Bearer $ADMIN_API_KEY"

# Read a specific file
curl -s "$HIVE_URL/api/data/SPACE_NAME/files/PATH/TO/file.md" -H "Authorization: Bearer $ADMIN_API_KEY"
```

---

## 4. Database Access

Each space creates a table `hive_{spacename}` in the Supabase Postgres instance configured for that space.

### Schema per space table
```sql
-- Table: hive_{spacename}
-- Columns: id (UUID), path (TEXT), filename (TEXT), content_text (TEXT),
--          content_blob (BYTEA), content_hash (TEXT),
--          created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)
-- Constraints: UNIQUE(path, filename)
-- Indexes: path, full-text GIN on content_text
```

### Diagnostic Queries
```bash
# List all hive tables in the database
psql "$SUPABASE_DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'hive_%';"

# Count files in a space
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM hive_SPACENAME WHERE filename != '.keep';"

# List files in a space
psql "$SUPABASE_DB_URL" -c "SELECT path, filename, length(content_text) as size, updated_at FROM hive_SPACENAME ORDER BY updated_at DESC LIMIT 20;"

# Check table structure
psql "$SUPABASE_DB_URL" -c "\d hive_SPACENAME"

# Find large files
psql "$SUPABASE_DB_URL" -c "SELECT path, filename, length(content_text) as bytes FROM hive_SPACENAME WHERE content_text IS NOT NULL ORDER BY length(content_text) DESC LIMIT 10;"

# Check database connectivity
psql "$SUPABASE_DB_URL" -c "SELECT 1 as connected;"

# List all tables and their row counts
psql "$SUPABASE_DB_URL" -c "SELECT relname as table, n_live_tup as rows FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;"
```

---

## 5. Debugging Workflow

When the user asks you to debug, follow this approach:

### Step 1. Check Railway Deployment
```bash
railway status
railway logs -d --lines 30
```
Verify the service is running and the latest deployment succeeded.

### Step 2. Check Application Logs
```bash
# Recent errors
railway logs --lines 50 --filter "@level:error"

# All recent logs
railway logs --lines 50

# HTTP errors
railway logs --http --status ">=400" --lines 20
```

### Step 3. Verify API Health
```bash
ADMIN_API_KEY='...'
HIVE_URL='...'

# Auth working?
curl -s "$HIVE_URL/api/auth/verify" -H "Authorization: Bearer $ADMIN_API_KEY"

# Spaces configured?
curl -s "$HIVE_URL/api/admin/spaces" -H "Authorization: Bearer $ADMIN_API_KEY"

# UI accessible?
curl -sI "$HIVE_URL/ui/" | head -5
```

### Step 4. Check Database Connectivity
```bash
SUPABASE_DB_URL='...'

# Can we connect?
psql "$SUPABASE_DB_URL" -c "SELECT 1 as connected;"

# Tables exist?
psql "$SUPABASE_DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'hive_%';"
```

### Step 5. Check /data Volume
The Railway volume at `/data` stores config (users, spaces, permissions). If the volume is missing or corrupted, the app will re-initialize from ADMIN_API_KEY.
```bash
# Check env vars are set
railway variables
```

### Step 6. Analyze and Report
- Identify error patterns and their frequency
- Correlate timestamps across logs and database
- Check if the issue is in auth, DB connection, file operations, or UI serving
- Provide a clear summary with root cause

---

## 6. Common Issues

- **Server won't start (PathError):** Express 5 requires named wildcards. Any route with bare `*` will crash at startup. Fix: change `*` to `*paramName`.
- **"Space not found":** Space directory exists in /data/spaces/ but the Postgres table may not exist (DB connection failed during creation). Recreate the space.
- **"Invalid API key":** The ADMIN_API_KEY env var is only used on first boot to seed /data/auth/users.json. Changing the env var after first boot has no effect. Check the actual key in users.json on the volume.
- **DB connection error:** Each space has its own Postgres connection string in /data/spaces/{name}/config.json. Verify the connection string is correct and the DB is accessible from Railway.
- **UI returns 404:** Check that the Vite build output exists at apps/ui/dist/ and that the production static serving is configured correctly.
- **Volume lost on redeploy:** Railway volumes persist across deploys, but if the volume was deleted, all config (users, spaces, permissions) is lost. Only ADMIN_API_KEY env var survives — it will re-seed the superuser on next boot.
- **Permission denied (403):** User has an API key but no grants for the requested space/path. Check /data/spaces/{name}/permissions.json.
- **File append not working:** PATCH endpoint expects `{ "content": "text to append" }` with Content-Type application/json.
- **Search returns empty:** Full-text search uses Postgres `to_tsvector('english', ...)`. Short words or stop words may not match. Try different search terms.
- **Folder markers visible:** `.keep` files are used as folder markers. They should be filtered from listings but may appear if there's a bug in the list query.

---

## 7. Instructions

- **CRITICAL — Read-Only Mode:** This is a debugging/investigation skill. NEVER use Edit, Write, NotebookEdit, or any destructive operations (DELETE requests, dropping tables, etc.) without EXPLICITLY asking the user for confirmation first. Your job is to diagnose and report, not to modify production systems.
- If the user provides `$ARGUMENTS`, focus debugging on those specific areas
- If no arguments given, do a broad health check: deployment status, API health, DB connectivity
- Parallelize checks when possible (railway logs + API calls + DB queries)
- Present findings in a clear, structured format with severity levels
- When you find errors, correlate them across Railway logs, API responses, and database state
- Always read secrets.md first before making any API calls or DB queries
