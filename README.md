# Hive — Personal Cloud

Your domain = your identity = your cloud. Hive is an open-source personal cloud where agents and people are contacts with scoped access to your data.

## Deploy to Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/hive)

Set `ADMIN_API_KEY` to any secure string. Add a Supabase Postgres connection when you create your first space.

## Run Locally

```bash
git clone https://github.com/yaneq/hive.git && cd hive
pnpm install
pnpm --filter @hive/shared build
ADMIN_API_KEY=your-secret-key DATA_DIR=./data pnpm run dev
```

Open http://localhost:3000 and log in with your admin API key.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_API_KEY` | Yes (first boot) | — | Seeds the admin user. Ignored after `/data/auth/users.json` exists. |
| `DATA_DIR` | No | `/data` | Where config and git-backed files are stored. Use `./data` locally. |
| `PORT` | No | `3000` | Server port. |

Each space needs a storage backend. Currently supported: Supabase Postgres (connect when creating a space). Git-based file storage is coming soon.

## What You Get

- **Spaces** — top-level containers for files, each with its own storage backend
- **Files & folders** — create, read, update, append, delete via REST API or web UI
- **Users & API keys** — create users with per-folder permissions
- **Agent API** — agents read/write files with scoped access ([AGENTS.md](AGENTS.md))
- **Full REST API** — see [openapi.yaml](openapi.yaml) for all endpoints

## Contributing

See [CLAUDE.md](CLAUDE.md) for dev workflow, architecture, and conventions. Use `pnpm`, feature branches against `develop`.
