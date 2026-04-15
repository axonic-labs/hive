# Virtual Backends — Design Considerations

*Status: Future feature (post-MVP)*

## Concept

Virtual backends are read-only persistence backends that present external API data as markdown files in Hive buckets. Agents and apps access them through the same API as regular buckets — they don't need to know the data is virtual.

## Architecture Fit

The persistence layer already supports pluggable per-bucket backends. A virtual backend implements the same `PersistenceBackend` interface:

- `list()` / `read()` / `exists()` — translate to external API calls
- `write()` / `delete()` — throw "read-only bucket" error

No changes needed to data, permissions, auth, or app layers.

## Caching

External APIs are slow and rate-limited, so virtual backends use a cache-through pattern:

- **Read path:** Check local cache first. If fresh, return cached. If stale/missing, fetch from source, cache, return.
- **Refresh path:** A cron job periodically calls `list()` on the source, fetches all items, writes to cache. Reads between refreshes are instant.

```yaml
buckets:
  health-strava:
    backend: strava
    mode: read_only
    cache:
      backend: filesystem
      path: .cache/health-strava
      refresh: "0 */6 * * *"    # every 6 hours
      max_age: 86400             # force re-fetch after 24h
```

Cache uses the existing filesystem persistence backend — just two backends composed together.

## Example: Strava Integration

### OAuth Flow
- Register app at strava.com/settings/api (client ID + secret)
- `GET /auth/strava` — redirects to Strava consent page
- `GET /auth/strava/callback` — exchanges code for access + refresh tokens
- Tokens stored server-side. Access tokens expire every 6h, auto-refresh via refresh token.
- UI: single "Connect Strava" button.

### API Mapping
| PersistenceBackend | Strava API |
|---|---|
| `list("activities/")` | `GET /api/v3/athlete/activities` |
| `read("activities/2026-04-13-morning-run.md")` | `GET /api/v3/activities/{id}` |
| `exists(...)` | Check if activity ID is valid |

### Markdown Output
```markdown
# Morning Run
- Date: 2026-04-13 07:30
- Distance: 8.2 km
- Duration: 42:15
- Pace: 5:09/km
- Elevation: 124m
```

### Rate Limits
Strava allows 100 requests/15min, 1000/day. With 6-hour refresh cycles, typical usage is 10-20 requests per refresh — well within limits.

## Example: Apple Health

No cloud API — data lives on-device. Approaches:
- **iOS Shortcuts** that periodically export health data to Hive via REST API (push model)
- **Health Auto Export** app pushing to Hive endpoint
- **Manual CSV/JSON import** via a Hive app

Apple Health would use a regular filesystem bucket receiving pushed data, not a true virtual backend.

## Future Providers

Any API with list/read semantics could become a virtual backend: Google Calendar, GitHub activity, Spotify listening history, bank transactions, etc. The pattern is always the same: implement `PersistenceBackend`, add OAuth flow, define markdown format, configure cache refresh.
