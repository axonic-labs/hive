# Hive — Personal Cloud Standard
## Requirements & Architecture Document

*Created: April 2026*
*Author: Jan + Claude*
*Status: Requirements complete. Ready to build MVP.*

---

## Vision

Hive is an open-source personal cloud standard. Your domain = your identity = your cloud. Agents and people are contacts who get scoped access to your data. Apps run on your data in your context. You control everything.

**Tagline:** "Run your own Hive."

**What makes this different from the 14 projects that tried before (Solid, remoteStorage, Urbit, etc.):** AI agents are the killer app. Every builder in 2026 struggles with giving agents persistent, scoped access to user context. Hive solves this natively.

---

## Architecture (7 Layers)

```
┌──────────────────────────────────────────────────────┐
│  7. APP LAYER                                         │
│  Short-lived scripts triggered by cron or webhooks.   │
│  Run in user context with scoped permissions.         │
│  Identity: appname@yourdomain.com                     │
├──────────────────────────────────────────────────────┤
│  6. SERVICES LAYER                                    │
│  Server-provided capabilities apps can use.           │
│  LLM, email, etc. Apps never see raw API keys.        │
├──────────────────────────────────────────────────────┤
│  5. AUTH LAYER                                        │
│  API keys (MVP). UCAN/OAuth later.                    │
│  Resolves credentials → contact identity.             │
├──────────────────────────────────────────────────────┤
│  4. PERMISSIONS LAYER                                 │
│  Per-contact, per-bucket, per-folder.                 │
│  Read or read/write. Explicit, no inheritance.        │
├──────────────────────────────────────────────────────┤
│  3. CONTACTS LAYER                                    │
│  People (email) and agents (URI). All are contacts.   │
│  Contact types: human, agent, service.                │
├──────────────────────────────────────────────────────┤
│  2. DATA LAYER                                        │
│  Files in folders. Buckets as top-level containers.   │
│  Markdown files. Minimal metadata (path, timestamps). │
├──────────────────────────────────────────────────────┤
│  1. PERSISTENCE LAYER                                 │
│  Pluggable per-bucket backends.                       │
│  LCD interface: read, write, delete, list.            │
│  Audit log: all writes logged with before/after.      │
└──────────────────────────────────────────────────────┘
```

---

## Layer Details

### Layer 1: Persistence

**Interface (lowest common denominator):**
```typescript
interface PersistenceBackend {
  read(path: string): Promise<{ content: string, modified: Date }>
  write(path: string, content: string): Promise<void>
  delete(path: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}
```

**Per-bucket backends.** Each bucket configures which backend it uses:
- `notes` bucket → local filesystem (MVP)
- `photos` bucket → Google Cloud Storage (future)
- `passwords` bucket → encrypted local (future)

**Audit log:** Every write operation logged to an append-only file:
```json
{"timestamp": "2026-04-05T03:00:00Z", "contact": "dreamer@yaneq.com", "bucket": "notes", "path": "profile/personal.md", "action": "write", "before_hash": "abc123", "after_hash": "def456", "before_content": "...", "after_content": "..."}
```

**MVP backend:** Local filesystem on Railway container + S3 backup sync for durability.

**Future backends:** Git, Supabase, S3-native, Google Cloud Storage, encrypted local.

### Layer 2: Data

- Everything is a file in a folder structure
- Multiple buckets exist in parallel (each with its own backend)
- Files are markdown by default (but any format supported)
- Minimal metadata: path, content, created timestamp, modified timestamp
- Extensible later (tags, schemas) but not in MVP

**MVP:** Single bucket called `notes`. Markdown files only.

### Layer 3: Contacts

- Identified by email (humans) or `appname@domain` (agents/apps)
- Contact types: `human`, `agent`, `service`
- Agents ARE contacts — same treatment as humans
- Apps running on the server get identities: `dreamer@yaneq.com`

**MVP:** Contacts defined in YAML config file. No UI for management.

### Layer 4: Permissions

- Scoped per-contact, per-bucket, per-folder path
- Two levels: `read`, `read_write`
- Default: owner has full access, everyone else has nothing
- Explicit grants — no inheritance from parent folders
- Wildcard support: `notes/*` grants access to entire bucket

**MVP:** Permissions in YAML config alongside contacts.

```yaml
contacts:
  - id: jan@yaneq.com
    type: human
    role: owner  # full access to everything

  - id: claude-personal@yaneq.com
    type: agent
    api_key: "sk-..."
    permissions:
      - bucket: notes
        path: "*"
        access: read_write

  - id: zonic-advisor@yaneq.com
    type: agent
    api_key: "sk-..."
    permissions:
      - bucket: notes
        path: "zonic/*"
        access: read
      - bucket: notes
        path: "profile/context-summary.md"
        access: read

  - id: dreamer@yaneq.com
    type: agent
    api_key: "sk-..."
    permissions:
      - bucket: notes
        path: "journal/*"
        access: read
      - bucket: notes
        path: "profile/*"
        access: read_write
```

### Layer 5: Auth

**MVP:** API key per contact. Sent as Bearer token. Server resolves key → contact → permissions.

**Future:** OAuth 2.1, UCAN tokens for delegated auth.

### Layer 6: Services

Server-provided capabilities that apps can use without seeing raw credentials.

```typescript
interface HiveServices {
  llm: {
    complete(prompt: string, options?: LLMOptions): Promise<string>
  }
  // Future: email, notifications, etc.
}
```

**MVP:** LLM service only (wraps Anthropic/OpenAI API). Server holds the API key.

### Layer 7: Apps

- Apps are `.ts`/`.js` files in a designated folder on the server
- Each app exports a handler function
- Runtime calls handler with a scoped API client + services
- Apps register cron schedules and/or webhook triggers
- Apps are short-lived (run, do work, exit)
- Apps get a contact identity (e.g., `dreamer@yaneq.com`)

```typescript
// apps/dreamer/index.ts
export default {
  name: "dreamer",
  contact: "dreamer@yaneq.com",
  cron: "0 3 * * *",  // 3am daily
  
  async handler(ctx: HiveAppContext) {
    const entries = await ctx.bucket("notes").list("journal/");
    const today = entries.filter(isToday);
    
    for (const entry of today) {
      const content = await ctx.bucket("notes").read(entry);
      const summary = await ctx.services.llm.complete(
        `Summarize key decisions and insights: ${content}`
      );
      // Update profile with new insights
      const profile = await ctx.bucket("notes").read("profile/personal.md");
      const updated = await ctx.services.llm.complete(
        `Update this profile with new insights: ${profile}\n\nNew insights: ${summary}`
      );
      await ctx.bucket("notes").write("profile/personal.md", updated);
    }
  }
}
```

---

## API (REST)

```
Discovery:
GET  /.well-known/hive              → server info, identity, public metadata

Buckets:
GET  /api/buckets                    → list accessible buckets

Files:
GET  /api/buckets/:bucket/files      → list files (optional ?prefix=)
GET  /api/buckets/:bucket/files/*path → read file
PUT  /api/buckets/:bucket/files/*path → write file
DELETE /api/buckets/:bucket/files/*path → delete file

Search:
GET  /api/buckets/:bucket/search?q=  → full-text search

Access Requests:
POST /api/access-requests             → request access to bucket/path
GET  /api/access-requests             → list pending requests (owner only)
POST /api/access-requests/:id/approve → approve request
POST /api/access-requests/:id/deny    → deny request

Events:
WS   /api/events                      → real-time file change notifications

Auth:
All endpoints require Bearer token (API key).
Owner authenticates via master key or session.
```

---

## MCP Server

Built into the Hive server (or as sidecar). Exposes:

- **Resources:** Each accessible file as an MCP resource
- **Tools:** `read_file`, `write_file`, `list_files`, `search`
- **Prompts:** `load_context` (returns context-summary.md)

Any MCP-compatible tool (Claude Code, Claude Desktop, Cursor) connects to the Hive MCP server and gets scoped access based on the contact's permissions.

---

## Public Discovery

`GET /.well-known/hive` returns:
```json
{
  "version": "0.1.0",
  "identity": "jan@yaneq.com",
  "display_name": "Jan's Hive",
  "endpoints": {
    "api": "https://yaneq.com/api",
    "mcp": "https://yaneq.com/mcp",
    "websocket": "wss://yaneq.com/api/events"
  },
  "access_request_url": "https://yaneq.com/api/access-requests"
}
```

Anyone/any agent can discover your Hive via your domain and request access.

---

## MVP Scope

**Stack:** Node.js / TypeScript
**Hosting:** Railway or Fly.io
**Persistence:** Local filesystem + S3 backup

### Build:
1. REST API server with all endpoints
2. Persistence layer interface + filesystem backend
3. Contacts + permissions from YAML config
4. API key auth middleware
5. Audit log (append-only file, synced to S3)
6. Full-text search (grep over files)
7. MCP server (exposes files as MCP resources)
8. App runtime (cron scheduler + script executor)
9. One example app: dreamer (nightly journal → profile updater)
10. Discovery endpoint (/.well-known/hive)

### Don't build:
- Web UI (use GitHub/raw file access for now, or build separately)
- Telegram bot (separate project)
- OAuth/UCAN (API keys sufficient)
- Encryption at rest
- Vector search / embeddings
- Multi-bucket backends (everything on filesystem for MVP)
- Rate limiting
- Client-side sync / offline

---

## Lessons from Failed Predecessors (Design Principles)

1. **Ship first, standardize later.** Solid died from over-specification. Extract the protocol from working code.
2. **Narrow focus.** Solve agent context access first. Don't try to replace Google Drive + Calendar + Contacts + everything.
3. **Mobile matters but is a client concern.** The server is the protocol. Clients (web, mobile, CLI) are separate projects.
4. **Don't require linked data, RDF, or any complex format.** Files. Markdown. That's it.
5. **One-command setup.** `npx create-hive` or `docker-compose up`.
6. **Hosted option for non-technical users.** Someone offers hosted Hives at `username.hive.cloud`. Self-hosting always available.
7. **MCP compatibility = distribution.** Instant access to millions of AI tool users.
8. **The EU Data Act is tailwind.** Mandatory data portability (effective Sep 2025) favors user-controlled infrastructure.

---

## Future Considerations

### Near-term (post-MVP)
- Web UI PWA (mobile-friendly markdown editor/browser)
- Telegram bot for mobile input
- Multiple persistence backends per bucket
- Access request UI (approve/deny in browser)
- CLI tool for power users
- Hot-reload config changes

### Medium-term
- OAuth 2.1 / UCAN for proper auth
- Embeddings service (app that generates vectors for semantic search)
- Knowledge graph indexing (app that builds relationships from file contents)
- A2A protocol support (agents discovering and talking to each other through Hives)
- Encryption at rest (per-bucket)
- Multi-user support (shared Hives)

### Long-term (the dream)
- Protocol specification (extract from implementation)
- Federation (Hive-to-Hive communication, like email)
- App marketplace (community-built apps)
- Hosted service (anyone can spin up a Hive at their domain)
- Photos, calendar, contacts as standard bucket types with dedicated apps
- The personal cloud becomes infrastructure — like email, everyone has one

---

## Why Now

For 20 years this idea existed without a killer app. Email was close but calcified. Social media took the app-on-your-data model and centralized it. Nextcloud solved file sync but not agent access.

Now: AI agents need persistent, scoped access to user context. Every builder is reinventing this. MCP provides the access protocol but no data layer. A2A provides agent communication but no data layer. UCAN provides auth but no data layer.

**Hive IS the data layer.** The personal data infrastructure that MCP, A2A, and UCAN all assume exists but nobody has built as a standard.

The timing is right. The need is real. And Jan has been thinking about this for two decades.
