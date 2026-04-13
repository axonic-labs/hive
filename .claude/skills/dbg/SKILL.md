---
name: dbg
description: Debug production issues using Railway API, database queries, and application logs. Use when investigating errors, checking deployment status, or diagnosing problems.
argument-hint: "[description of issue or area to investigate]"
---

# Debug Skill

Debug production issues for the **Hive** project on Railway.

## Setup

1. Read `.claude/skills/dbg/secrets.md` for credentials.
2. Use the `RAILWAY_TOKEN`, `DB_URL`, and `LOKI_URL` values from that file.

> **IMPORTANT — Credential Setup:**
> In every Bash call that needs secrets, assign them as **single-quoted** variables at the top, then use `$VARIABLE` references. Single quotes prevent shell interpretation of special characters in tokens. Shell state does not persist between Bash calls, so re-set variables in every call that needs them.

## Infrastructure Access

### Railway GraphQL API
- **Endpoint:** `https://backboard.railway.com/graphql/v2`
- **Auth:** `Authorization: Bearer $RAILWAY_TOKEN`
- **Content-Type:** `application/json`

### Database (psql)
- **Connection:** `$DB_URL`
- **Usage:** `psql "$DB_URL" -c "QUERY"`
- Add `--csv` for machine-readable output, or `-x` for expanded display

### Loki Log Server (when configured)
- **Base URL:** `$LOKI_URL`
- **API:** Loki HTTP API (`/loki/api/v1/query_range`, `/loki/api/v1/labels`, etc.)

## Debugging Workflow

### Step 1: Read secrets

```bash
# Always start by reading secrets
cat .claude/skills/dbg/secrets.md
```

### Step 2: Check Deployment Status

Query Railway API for the latest deployment:

```bash
RAILWAY_TOKEN='<from secrets>'
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ deployments(input: { serviceId: \"SERVICE_ID\", environmentId: \"ENV_ID\" }, first: 1) { edges { node { id status createdAt } } } }"}'
```

### Step 3: Pull Deployment Logs

Use the deployment ID from step 2:

```bash
curl -s https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ deploymentLogs(deploymentId: \"DEPLOYMENT_ID\", limit: 100) { timestamp message severity } }"}'
```

### Step 4: Query Loki for Application Logs (when configured)

```bash
curl -s "$LOKI_URL/loki/api/v1/query_range" \
  --data-urlencode 'query={level="error"}' \
  --data-urlencode 'limit=100' \
  --data-urlencode "start=$(date -u -v-1H +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000"
```

### Step 5: Query Database

For state inspection, use diagnostic queries below.

### Step 6: Analyze and Report

- Identify error patterns and their frequency
- Correlate timestamps across services
- Cross-reference database state with log evidence
- Provide a clear summary with root cause analysis

## Database Diagnostic Queries

Use with: `psql "$DB_URL" -c "QUERY"`

### List all tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

### Table structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'TABLE_NAME'
ORDER BY ordinal_position;
```

### Recent activity (adapt to actual tables)
```sql
-- Example: check recent data in any table
SELECT * FROM <table> ORDER BY created_at DESC LIMIT 20;
```

## Instructions

- **CRITICAL — Read-Only Mode:** This is a debugging/investigation skill. NEVER modify production data or run destructive operations (DELETE, UPDATE, DROP) without explicitly asking the user for confirmation first. Your job is to diagnose and report.
- Always read `secrets.md` first to get current credentials.
- If the user provides `$ARGUMENTS`, focus debugging on that specific issue.
- If no arguments given, do a broad health check.
- Parallelize API calls when checking multiple services.
- Present findings in a clear, structured format with severity levels.
- When Loki is not yet configured, note it and rely on Railway logs + database state.
