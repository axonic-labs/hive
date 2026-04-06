# Hive — Agent Integration Guide

Hive is a personal cloud. You are interacting with someone's Hive instance — their files, their data, their rules. Respect the permissions you've been granted.

## Quick Start

You have an API key and a Hive URL. Authenticate with Bearer token:

```bash
curl https://HIVE_URL/api/data/notes/files \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Authentication

All requests require `Authorization: Bearer <api_key>` header. Your key is scoped — you can only access spaces and paths you've been granted permission to.

## Endpoints

Base URL: `https://<hive-domain>/api`

### Files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/data/:space/files` | List files. Optional `?prefix=journal/` to filter by path |
| `GET` | `/data/:space/files/:path` | Read file content (returns plain text) |
| `POST` | `/data/:space/files` | Create file: `{ "path": "journal", "filename": "entry.md", "content": "..." }` |
| `PUT` | `/data/:space/files/:path` | Overwrite file. Send content as `text/plain` body |
| `PATCH` | `/data/:space/files/:path` | Append to file: `{ "content": "line to append" }`. Auto-adds newline. Creates file if missing |
| `DELETE` | `/data/:space/files/:path` | Delete a file |
| `GET` | `/data/:space/search?q=term` | Full-text search across files in a space |

### Path Format

Paths are slash-separated: `journal/2026/04/entry.md`

- `GET /data/notes/files/journal/2026/04/entry.md` — read a specific file
- `GET /data/notes/files?prefix=journal/2026/` — list files under a folder
- `PATCH /data/notes/files/journal/2026/04/entry.md` — append to a file

### Verify Your Identity

```
POST /api/auth/verify
```

Returns your user info and confirms your key is valid.

## Permissions

Your API key has specific grants:
- **Space access** — which spaces you can see (e.g., `notes`)
- **Path access** — which folders within a space (e.g., `journal/` grants access to everything under `journal/`)
- **Access level** — `read` or `read_write`

If you try to access a path you don't have permission for, you'll get a `403`. Listings are filtered — you only see files you're allowed to access.

## Content Format

- Files are primarily **Markdown** (`.md`)
- `GET` returns `text/plain`
- `PUT` accepts `text/plain` body (raw content) or `application/json` with `{ "content": "..." }`
- `PATCH` accepts `application/json` with `{ "content": "text to append" }`
- `POST` (create) accepts `application/json` with `{ "path": "...", "filename": "...", "content": "..." }`

## Errors

```json
{ "error": "File not found", "status": 404 }
```

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing API key |
| 403 | No permission for this space/path |
| 400 | Bad request (missing fields, duplicate file, invalid input) |
| 404 | File or space not found |

## Best Practices

- **Append, don't overwrite** — use `PATCH` to add entries to logs, journals, or running documents. It's safer than reading + modifying + writing.
- **Use meaningful paths** — organize files in folders that reflect their purpose: `journal/2026-04-05.md`, `profile/context.md`, `projects/hive/notes.md`
- **Check before writing** — `GET` the file first if you need to modify specific content. Use `PUT` only when you intend to replace the entire file.
- **Respect your scope** — if you have access to `journal/`, don't try to read `profile/`. Your listing will already be filtered, but failed reads waste calls.

## Example: Journal Bot

```bash
API_KEY="hive_abc123..."
HIVE="https://hive.yaneq.com"

# Append today's entry
curl -X PATCH "$HIVE/api/data/notes/files/journal/2026-04-05.md" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "## 14:30 — Shipped the MVP\nHive is live. First agent connected."}'

# Read it back
curl "$HIVE/api/data/notes/files/journal/2026-04-05.md" \
  -H "Authorization: Bearer $API_KEY"

# Search across all accessible files
curl "$HIVE/api/data/notes/search?q=shipped" \
  -H "Authorization: Bearer $API_KEY"
```
