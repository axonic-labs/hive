# Hive — Personal Cloud Standard

## What is this
Hive is an open-source personal cloud. Your domain = your identity = your cloud. Agents and people are contacts with scoped access to your data. Apps run on your data in your context.

## Key docs
- `requirements.md` — Full architecture spec, 7 layers, MVP scope, design decisions

## Architecture (7 layers, bottom up)
1. **Persistence** — Pluggable per-bucket backends (filesystem MVP). Audit log on all writes (before/after).
2. **Data** — Files in folders. Buckets as top-level containers. Markdown. Minimal metadata.
3. **Contacts** — People (email) and agents (URI). Agents ARE contacts.
4. **Permissions** — Per-contact, per-bucket, per-folder. Read or read_write. Explicit, no inheritance.
5. **Auth** — API keys (MVP). Resolves key → contact → permissions.
6. **Services** — Server-provided capabilities (LLM, etc.). Apps never see raw API keys.
7. **Apps** — Short-lived scripts. Cron + webhook triggers. Run in scoped permission context.

## Stack
- Node.js / TypeScript
- REST API + MCP server
- Deploy to Railway or Fly.io
- Local filesystem + S3 backup (MVP persistence)

## Builder context
- Creator: Jan (jan@yaneq.com), CTO, 25+ years building software
- This is a personal tool first, designed for future standardization
- Read requirements.md before implementing anything
- Keep it simple — the #1 lesson from 14 failed predecessors is: ship first, standardize later

## Before implementing any task

Sanity-check the request before writing code:

| Check | Ask yourself |
|-------|-------------|
| **Product value** | Does this actually improve the experience, or is it an edge case that doesn't justify the complexity? |
| **Architecture fit** | Does it fit cleanly in the 7-layer architecture? Or does it need hacks? |
| **Scope creep** | Does it sound simple but actually imply a much larger change? |
| **Better alternative** | Is there a simpler way to solve the underlying problem? |
| **MVP alignment** | Does this fit MVP scope, or is it premature complexity? |

If concerns arise, raise them before starting. For complex tasks (new schema, new endpoints, cross-layer changes, vague requirements), interview the user to build a plan before implementing.

## Git workflow
- Branch from `main`, prefix: `yaneq/`
- Use `pnpm` (never `npm`)
- Build before PR: `pnpm run build`
- Use `/create-pr` skill when code is ready — it handles build, review, push, PR creation, and @claude review request
