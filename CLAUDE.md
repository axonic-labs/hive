# Hive — Personal Cloud

## What is this
Hive is an open-source personal cloud. Your domain = your identity = your cloud. Agents and people are contacts with scoped access to your data.

## Key docs
- `requirements.md` — Original vision & 7-layer architecture (aspirational, not all implemented)
- `openapi.yaml` — Full OpenAPI 3.1 spec for the current API
- `AGENTS.md` — Agent integration guide
- `skills/debug/` — Production debugging skill (Railway CLI + Supabase + Hive API)

## Current state (MVP, shipped 2026-04-05)
Working system deployed to Railway at hive.yaneq.com. Superuser can log in, create spaces backed by Supabase Postgres, manage files/folders, create users with API keys and folder-scoped permissions. Agents can read/write files via REST API.

## Architecture

```
┌───────────────────────────────────────────────┐
│  React SPA (Vite) served at /                 │
├───────────────────────────────────────────────┤
│  Express 5 API server                         │
│  ├── /api/auth/verify      Auth (all users)   │
│  ├── /api/admin/spaces     Space mgmt (admin) │
│  ├── /api/admin/users      User mgmt (admin)  │
│  └── /api/data/:space/*    File CRUD + search │
├───────────────────────────────────────────────┤
│  Auth: unified API key (Bearer token)         │
│  Permissions: per-space JSON files at /data   │
├───────────────────────────────────────────────┤
│  Config: /data/ (Railway volume)              │
│  Content: Supabase Postgres (per-space conn)  │
└───────────────────────────────────────────────┘
```

## Project structure
```
hive/
├── apps/
│   ├── api/          # Express server (Node.js/TypeScript)
│   ├── ui/           # React SPA (Vite)
│   └── shared/       # Shared types (@hive/shared)
├── skills/debug/     # Production debug skill
├── openapi.yaml      # API spec
├── AGENTS.md         # Agent integration guide
└── requirements.md   # Original vision doc
```

## Stack
- **Runtime:** Node.js / TypeScript, Express 5
- **Frontend:** React 19, Vite, React Router 7
- **Database:** Supabase Postgres (per-space connections via `pg`)
- **Config storage:** JSON files on Railway volume at `/data`
- **Deployment:** Railway (single service, volume mount)
- **Monorepo:** pnpm workspaces

## Key design decisions
- **Unified API key auth** — admin and regular users use the same Bearer token mechanism. No JWT, no sessions. UI stores key in localStorage.
- **Per-space database connections** — each space has its own Postgres connection string. Different spaces can point to different Supabase projects.
- **"Spaces" not "buckets"** — top-level containers for files. Each space = one Postgres table (`hive_{spacename}`).
- **Config on disk, content in DB** — users/permissions/space config stored as JSON at `/data/` (Railway volume). File content stored in Postgres.
- **ADMIN_API_KEY env var** — only used on first boot to seed `/data/auth/users.json`. After that, the env var is ignored.
- **Folders as `.keep` markers** — folders are rows with `filename='.keep'` in the space table. No empty folder without a marker.
- **Recursive prefix permissions** — granting `journal/` covers everything under it.
- **Filtered listings** — non-admin users only see files they have permission to access.
- **Server-side append** — PATCH endpoint auto-newlines and creates-if-missing.
- **content_hash** — SHA-256 stored on every write for future bidirectional sync.

## /data directory layout (Railway volume)
```
/data/
├── auth/
│   └── users.json                    # All users with API keys
└── spaces/
    └── {spacename}/
        ├── config.json               # { type: "postgres", database_url: "..." }
        └── permissions.json          # Per-user folder grants
```

## Express 5 gotcha
Express 5 uses path-to-regexp v8 which requires **named wildcards**. Use `*path` or `*splat`, never bare `*`. This will crash at startup if wrong.

## Dev workflow
```bash
pnpm install
ADMIN_API_KEY=test-key DATA_DIR=./data pnpm run dev   # single server, Vite HMR
pnpm run build                                         # shared → ui → api
```

## Git workflow
- Default branch: `develop`
- Feature branches → PRs against `develop`
- Add `@claude review` comment on PRs
- Never push directly to main or develop

## Not yet built (from requirements.md)
- MCP server
- Audit log
- Apps layer (cron, webhooks, script runtime)
- Services layer (LLM proxy)
- WebSocket events
- Access request workflow
- Discovery endpoint (/.well-known/hive)
- OAuth / UCAN auth
- Web UI for permission management in space explorer (partially done)
