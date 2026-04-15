# Import Claude Share Links into Chatlog

**Status:** Shelved (2026-04-15)

## Goal
Import conversations from Claude share links (e.g. `https://claude.ai/share/64bef8df-...`) into the chatlog space with proper message attribution (human/assistant) and a back-link to the original thread.

## Why shelved
Copy/paste approach has two problems:
1. **No back-link** — the share URL is lost since we're just pasting text
2. **Poor role separation** — pasted text doesn't cleanly distinguish human vs assistant messages. Date stamps (`Apr 11`) appear between them but splitting claude responses from the next human message is heuristic and fragile.

## Approaches considered

### A. Copy/paste with parsing (rejected)
- User copies text from share page, pastes into Hive UI
- Parse on date-line patterns to split turns
- Problems: no URL metadata, unreliable parsing

### B. Server-side fetch (blocked)
- Cloudflare bot protection returns 403 for all server-side requests to `claude.ai/share/*`
- Would need headless browser (Puppeteer) — heavy dependency

### C. Browser extension (best option, future)
- Content script runs on `claude.ai/share/*` pages
- Has full DOM access — can reliably extract messages with roles from page structure
- Can include the share URL as metadata
- Sends parsed conversation to Hive API
- One-click "Save to Hive" button on share pages
- Small, simple extension — content script + Hive API call

## When to revisit
When the browser extension approach is worth the setup cost, or if Claude exposes a public API for share data.
