# LucidLink API Service - Usage Guide

## Overview

This package provides two components for interacting with LucidLink filespaces:

1. **LucidLink File Service** (FastAPI) - A REST API running on `ai-factory-mini` that provides direct filesystem operations on a mounted LucidLink filespace. No authentication required within the Tailscale network.

2. **LucidLink Management API** (Docker) - The official LucidLink API container (`lucidlink/lucidlink-api:latest`) for managing filespaces, members, groups, and permissions. Requires a bearer token.

3. **Supabase Edge Function** (`lucidlink-browse`) - A serverless function that wraps the Management API for frontend use with Supabase auth.

---

## Part 1: LucidLink File Service (FastAPI)

**Base URL:** `https://ai-factory-mini.tail333a1d.ts.net`
**Workspace:** `agentics-markt`
**Filespace:** `my-app-bucket`
**Auth:** None (Tailscale network access only)
**Docs:** `https://ai-factory-mini.tail333a1d.ts.net/docs`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check, returns workspace and filespace info |
| GET | `/files?path=/` | List directory contents |
| GET | `/files/read?path=/file.txt` | Read file contents |
| POST | `/files/write` | Write/create a file (JSON body) |
| POST | `/files/mkdir?path=/dir` | Create a directory |
| DELETE | `/files?path=/file.txt` | Delete a file |
| DELETE | `/files/dir?path=/dir&recursive=true` | Delete a directory |
| POST | `/files/move` | Move/rename a file or directory (JSON body) |
| GET | `/files/stat?path=/file.txt` | Get file/directory metadata |
| GET | `/files/exists?path=/file.txt` | Check if a path exists |

### Human Usage Examples

**List the root directory:**
```bash
curl https://ai-factory-mini.tail333a1d.ts.net/files?path=/
```

**Read a file:**
```bash
curl "https://ai-factory-mini.tail333a1d.ts.net/files/read?path=/hello-api.txt"
```

**Create a directory:**
```bash
curl -X POST "https://ai-factory-mini.tail333a1d.ts.net/files/mkdir?path=/my-new-folder"
```

**Write a file:**
```bash
curl -X POST https://ai-factory-mini.tail333a1d.ts.net/files/write \
  -H "Content-Type: application/json" \
  -d '{"path": "/my-new-folder/notes.txt", "content": "Hello from the API"}'
```

**Move/rename:**
```bash
curl -X POST https://ai-factory-mini.tail333a1d.ts.net/files/move \
  -H "Content-Type: application/json" \
  -d '{"src": "/old-name.txt", "dst": "/new-name.txt"}'
```

**Check if a path exists:**
```bash
curl "https://ai-factory-mini.tail333a1d.ts.net/files/exists?path=/my-new-folder"
```

**Get file info:**
```bash
curl "https://ai-factory-mini.tail333a1d.ts.net/files/stat?path=/my-new-folder/notes.txt"
```

**Delete a file:**
```bash
curl -X DELETE "https://ai-factory-mini.tail333a1d.ts.net/files?path=/my-new-folder/notes.txt"
```

**Delete a directory (recursive):**
```bash
curl -X DELETE "https://ai-factory-mini.tail333a1d.ts.net/files/dir?path=/my-new-folder&recursive=true"
```

### Response Formats

**GET /health:**
```json
{"status": "ok", "workspace": "agentics-markt", "filespace": "my-app-bucket"}
```

**GET /files (directory listing):**
```json
[
  {"name": "docs", "is_dir": true, "size": 0, "path": "/docs"},
  {"name": "readme.txt", "is_dir": false, "size": 1234, "path": "/readme.txt"}
]
```

**GET /files/stat:**
```json
{"name": "readme.txt", "size": 1234, "is_dir": false, "is_file": true}
```

**GET /files/exists:**
```json
{"exists": true}
```

**POST /files/write, /files/mkdir, /files/move:**
```json
{"status": "ok"}
```

---

## Part 2: LucidLink Management API (Docker)

**Image:** `lucidlink/lucidlink-api:latest`
**Default Port:** 3003
**Auth:** Bearer token required

### Setup

```bash
cd docker/
docker compose up -d
```

The container starts a NestJS application that exposes the full LucidLink management API.

### Endpoints (all prefixed with `/api/v1`)

**Filespaces:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/filespaces` | List all filespaces |
| POST | `/filespaces` | Create a filespace |
| GET | `/filespaces/:id` | Get filespace details |
| PATCH | `/filespaces/:id` | Update a filespace |
| DELETE | `/filespaces/:id` | Delete a filespace |

**Entries (Directory & File Management):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/filespaces/:id/entries/resolve?path=/` | Resolve a path to an entry ID |
| GET | `/filespaces/:id/entries/:entryId` | Get entry details |
| GET | `/filespaces/:id/entries/:entryId/children` | List children of an entry |
| POST | `/filespaces/:id/entries` | Create an entry |
| DELETE | `/filespaces/:id/entries/:entryId` | Delete an entry |

**Direct Links:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/filespaces/:id/direct-links` | List direct links |

**External Data Stores:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/filespaces/:id/external/data-stores` | List external data stores |
| POST | `/filespaces/:id/external/data-stores` | Create external data store |
| GET | `/filespaces/:id/external/data-stores/:dsId` | Get data store details |
| PATCH | `/filespaces/:id/external/data-stores/:dsId` | Update data store |
| DELETE | `/filespaces/:id/external/data-stores/:dsId` | Delete data store |

**External Entries:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/filespaces/:id/external/entries` | Create external entry |
| GET | `/filespaces/:id/external/entries/ids` | List external entry IDs |
| DELETE | `/filespaces/:id/external/entries/:entryId` | Delete external entry |

**Permissions:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/filespaces/:id/permissions` | List permissions |
| POST | `/filespaces/:id/permissions` | Create permission |
| PATCH | `/filespaces/:id/permissions/:permId` | Update permission |
| DELETE | `/filespaces/:id/permissions/:permId` | Delete permission |

**Members:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/members` | List all members |
| POST | `/members` | Create a member |
| GET | `/members/:id` | Get member details |
| PATCH | `/members/:id` | Update a member |
| DELETE | `/members/:id` | Delete a member |
| GET | `/members/:id/groups` | List member's groups |

**Groups:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups` | List all groups |
| POST | `/groups` | Create a group |
| GET | `/groups/:id` | Get group details |
| PATCH | `/groups/:id` | Update a group |
| DELETE | `/groups/:id` | Delete a group |
| GET | `/groups/:id/members` | List group members |
| PUT | `/groups/members` | Bulk add members |
| PUT | `/groups/:id/members/:memberId` | Add member to group |
| DELETE | `/groups/:id/members/:memberId` | Remove member from group |

**Other:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/providers` | List storage providers |

### Human Usage Examples

```bash
# Health check
curl http://localhost:3003/api/v1/health

# List filespaces (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3003/api/v1/filespaces

# Resolve a path to an entry ID
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3003/api/v1/filespaces/FS_ID/entries/resolve?path=/"

# List directory contents by entry ID
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3003/api/v1/filespaces/FS_ID/entries/ENTRY_ID/children?limit=100"
```

---

## Part 3: Supabase Edge Function (lucidlink-browse)

The `lucidlink-browse` edge function wraps the Management API for use from a frontend with Supabase authentication.

### Deploy

```bash
cd supabase/
supabase functions deploy lucidlink-browse
```

### Set Secrets

```bash
supabase secrets set LUCIDLINK_API_URL=http://YOUR_HOST:3003
supabase secrets set LUCIDLINK_API_KEY=YOUR_BEARER_TOKEN
```

### Actions

Call the function via POST with a JSON body containing an `action` field:

**Test connection (no auth required):**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/lucidlink-browse \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

**List filespaces (auth required):**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/lucidlink-browse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_JWT" \
  -d '{"action": "list-filespaces"}'
```

**Browse a directory:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/lucidlink-browse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_JWT" \
  -d '{"action": "browse", "filespace": "FS_ID", "path": "/", "limit": 100}'
```

**Scan for documents (ingests to Supabase):**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/lucidlink-browse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_JWT" \
  -d '{"action": "scan", "filespace": "FS_ID", "path": "/docs"}'
```

Supported scan file types: `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, `.eml`, `.msg`

---

## Replicating on a New Machine

### Prerequisites
- Docker installed
- Machine on the Tailscale network (for File Service access)
- Supabase CLI (optional, for edge function deployment)

### Steps

1. Clone the repo:
   ```bash
   git clone git@github.com:markt-heximal/lucidlink-api-service.git
   cd lucidlink-api-service
   ```

2. Start the Management API container:
   ```bash
   cd docker/
   cp .env.example .env    # Edit if changing the port
   docker compose up -d
   ```

3. Verify it's running:
   ```bash
   curl http://localhost:3003/api/v1/health
   ```

4. (Optional) Deploy the Supabase edge function:
   ```bash
   cd supabase/
   supabase functions deploy lucidlink-browse
   supabase secrets set LUCIDLINK_API_URL=http://THIS_HOST:3003
   supabase secrets set LUCIDLINK_API_KEY=YOUR_TOKEN
   ```

5. Use `scripts/setup.sh` for a guided setup, or `scripts/stop.sh` to tear down.

---

## RuFlo Agent Instructions

This section provides structured instructions for AI agents (Claude Code, RuFlo, claude-flow) to interact with the LucidLink File Service programmatically.

### Configuration

```
LUCIDLINK_FILE_SERVICE_URL=https://ai-factory-mini.tail333a1d.ts.net
LUCIDLINK_MANAGEMENT_API_URL=http://localhost:3003
LUCIDLINK_WORKSPACE=agentics-markt
LUCIDLINK_FILESPACE=my-app-bucket
```

### Agent Capabilities

The File Service (FastAPI) is the primary interface for agents. It requires no authentication within the Tailscale network and supports all filesystem operations.

### Tool Patterns

**Health Check / Connectivity Test:**
```bash
curl -sf https://ai-factory-mini.tail333a1d.ts.net/health | python3 -m json.tool
```
Expected: `{"status": "ok", "workspace": "agentics-markt", "filespace": "my-app-bucket"}`

**List Directory:**
```bash
curl -s "https://ai-factory-mini.tail333a1d.ts.net/files?path=/TARGET_DIR" | python3 -m json.tool
```
Returns array of `{name, is_dir, size, path}` objects.

**Check Before Write (idempotent pattern):**
```bash
# Always check existence before creating directories
EXISTS=$(curl -s "https://ai-factory-mini.tail333a1d.ts.net/files/exists?path=/my-dir" | python3 -c "import json,sys; print(json.load(sys.stdin)['exists'])")
if [ "$EXISTS" = "False" ]; then
  curl -s -X POST "https://ai-factory-mini.tail333a1d.ts.net/files/mkdir?path=/my-dir"
fi
```

**Write File (with JSON-safe content encoding):**
```bash
# Use python3 to safely JSON-encode file content for the API
curl -s -X POST https://ai-factory-mini.tail333a1d.ts.net/files/write \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json; print(json.dumps({'path': '/target/file.txt', 'content': open('/local/source/file.txt').read()}))")"
```

**Upload a Local Directory Tree:**
```bash
# Pattern: create dirs first, then write files
BASE_URL="https://ai-factory-mini.tail333a1d.ts.net"
REMOTE_ROOT="/remote-target"

# 1. Create directory structure
find /local/source -type d | while read dir; do
  relative="${dir#/local/source}"
  curl -s -X POST "$BASE_URL/files/mkdir?path=$REMOTE_ROOT$relative"
done

# 2. Upload files
find /local/source -type f | while read file; do
  relative="${file#/local/source}"
  curl -s -X POST "$BASE_URL/files/write" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json; print(json.dumps({'path': '$REMOTE_ROOT$relative', 'content': open('$file').read()}))")"
done
```

**Read File into Variable:**
```bash
CONTENT=$(curl -s "https://ai-factory-mini.tail333a1d.ts.net/files/read?path=/config/settings.json")
```

**Move/Rename:**
```bash
curl -s -X POST https://ai-factory-mini.tail333a1d.ts.net/files/move \
  -H "Content-Type: application/json" \
  -d '{"src": "/old/path", "dst": "/new/path"}'
```

### Agent Best Practices

1. **Always health-check first** before performing operations. If the service is down, report the failure rather than retrying blindly.

2. **Check existence before mkdir** to avoid errors on duplicate creation attempts.

3. **Use python3 for JSON encoding** when writing files -- raw string interpolation in JSON bodies will break on quotes, newlines, and special characters.

4. **Binary files are not supported** by the `/files/write` endpoint (content is a JSON string). For binary files, use the LucidLink client directly.

5. **Path format** -- all paths are absolute from the filespace root, starting with `/`. No trailing slashes.

6. **No authentication** is needed for the File Service -- it is protected by Tailscale network access.

7. **Rate limiting** -- the service has no built-in rate limiting, but be respectful of the underlying LucidLink sync. Batch operations sequentially rather than hammering with concurrent requests.

8. **Error handling** -- non-200 responses return `{"detail": "error message"}`. A 422 means validation error (bad/missing parameters).

### CLAUDE.md Integration

To give Claude Code agents access to LucidLink, add this to a project's `CLAUDE.md`:

```markdown
## LucidLink File Service

Read/write files on the LucidLink filespace via the API at:
`https://ai-factory-mini.tail333a1d.ts.net`

- `GET /files?path=/dir` — list directory
- `GET /files/read?path=/file` — read file
- `POST /files/write` — write file: `{"path": "/file", "content": "..."}`
- `POST /files/mkdir?path=/dir` — create directory
- `GET /files/exists?path=/path` — check existence
- `POST /files/move` — move: `{"src": "/old", "dst": "/new"}`
- `DELETE /files?path=/file` — delete file
- `DELETE /files/dir?path=/dir` — delete directory
```
