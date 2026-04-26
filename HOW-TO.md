# s3BEAR — How To Guide

A feature-by-feature technical reference. Each section explains **what the feature does**, **how to use it**, and includes a **real-world use case** so you know when to reach for it.

## Table of Contents

**Setup**
- [Local Development (Docker Compose)](#local-development-docker-compose)
- [Kubernetes Deployment (Helm)](#kubernetes-deployment-helm)
- [MinIO / S3 CORS Configuration](#minio--s3-cors-configuration)

**Core Features**
- [Authentication: Local + Azure Entra SSO](#authentication-local--azure-entra-sso)
- [Group-Based Bucket Permissions](#group-based-bucket-permissions)
- [Bucket Management & Quotas](#bucket-management--quotas)
- [Object Upload (Simple + Multipart)](#object-upload-simple--multipart)
- [Object Copy / Move](#object-copy--move)
- [Authenticated Image Proxy](#authenticated-image-proxy)
- [Public Share Links](#public-share-links)
- [Scheduled Cleanup Policies](#scheduled-cleanup-policies)
- [Audit Log](#audit-log)
- [Azure Entra User Import](#azure-entra-user-import)

**Operations**
- [Troubleshooting](#troubleshooting)

---

## Local Development (Docker Compose)

### Prerequisites

- Docker & Docker Compose
- `.env` file in project root (copy from `.env.example`)

### Start

```bash
cp .env.example .env   # fill in Azure + AWS credentials if needed
docker compose -f docker-compose.dev.yml up -d
```

### Services & Ports

| Service       | URL                       | Purpose               |
|---------------|---------------------------|-----------------------|
| Frontend      | http://localhost:3100     | React UI              |
| Backend       | http://localhost:8200     | FastAPI API + OpenAPI |
| MinIO         | http://localhost:9000     | S3-compatible storage |
| MinIO Console | http://localhost:9001     | MinIO admin UI        |
| PostgreSQL    | localhost:5432            | Database              |

### Default Admin Credentials

```
Email:    admin@admin.com
Password: admin
```

> Change `secrets.defaultAdminPassword` in production.

### Rebuild After Code Changes

```bash
# Backend
docker build -t s3bear-backend:1.0.1 ./backend && \
  docker compose -f docker-compose.dev.yml up -d backend

# Frontend
docker build -t s3bear-frontend:1.0.1 ./frontend && \
  docker compose -f docker-compose.dev.yml up -d frontend
```

### Database Migrations

Migrations run automatically on container start via the `backend-migrate` init service. To run manually:

```bash
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

---

## Kubernetes Deployment (Helm)

### Install from OCI Registry (recommended)

```bash
helm install s3bear oci://registry-1.docker.io/bearcomp/s3bear \
  --version 1.0.1 \
  --namespace s3bear --create-namespace \
  --set secrets.secretKey="$(openssl rand -hex 32)" \
  --set secrets.databaseUrl="postgresql+asyncpg://user:pass@postgres:5432/s3bear" \
  --set secrets.databaseUrlSync="postgresql://user:pass@postgres:5432/s3bear" \
  --set secrets.awsAccessKeyId="AKID..." \
  --set secrets.awsSecretAccessKey="ASAK..." \
  --set config.awsEndpointUrl="http://minio.minio-ns.svc:9000" \
  --set config.presignedUrlBase="https://minio.example.com" \
  --set ingress.host="s3bear.example.com"
```

### Install from Local Chart

```bash
helm install s3bear ./helm/s3bear \
  --namespace s3bear --create-namespace \
  -f my-values.yaml
```

### Key Helm Values

```yaml
config:
  # Internal S3 endpoint (backend → storage). In-cluster service DNS.
  awsEndpointUrl: "http://minio.minio-ns.svc:9000"

  # External S3 URL (browser → storage). REQUIRED for multipart upload.
  presignedUrlBase: "https://minio.example.com"

  multipartPartSizeMb: "10"      # 10MB parts
  presignedUrlExpiry: "3600"     # 1 hour
  allowedOrigins: '["https://s3bear.example.com"]'
```

### Production Checklist

- [ ] `secrets.secretKey` ≥32 random chars (used to sign JWTs)
- [ ] External PostgreSQL (`postgresql.enabled: false`) + backups
- [ ] `config.presignedUrlBase` points to publicly reachable S3/MinIO
- [ ] CORS configured on storage layer (see next section)
- [ ] `config.allowedOrigins` matches your frontend domain
- [ ] `ingress.tls.enabled: true` with valid cert
- [ ] Strong `secrets.defaultAdminPassword`
- [ ] Azure Entra credentials populated if SSO is required

---

## MinIO / S3 CORS Configuration

**Required for multipart upload and direct browser-to-storage transfers.** The browser uploads file parts directly to MinIO/S3 via presigned URLs, so CORS must allow the frontend origin.

### MinIO (Docker Compose — already configured)

```yaml
minio:
  environment:
    MINIO_API_CORS_ALLOW_ORIGIN: "*"   # tighten in prod
```

### MinIO (Kubernetes)

```yaml
env:
  - name: MINIO_API_CORS_ALLOW_ORIGIN
    value: "https://s3bear.example.com"
```

### AWS S3

```json
[
  {
    "AllowedOrigins": ["https://s3bear.example.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration file://cors.json
```

> The `ETag` header **must** be exposed — the frontend reads it from each part upload response to assemble the final object.

---

## Authentication: Local + Azure Entra SSO

### What it does

Two parallel auth paths, both yielding a JWT (HS256, 30-min access token + 7-day refresh token):

1. **Local auth** — email + password stored as bcrypt hash. Useful for service accounts and bootstrap.
2. **Azure Entra (Microsoft Entra ID / Azure AD)** — OIDC flow via MSAL. The frontend redirects users to Microsoft, exchanges the auth code at `/api/v1/auth/callback`, and issues a JWT bound to the Azure Object ID (`oid` claim).

Each path can be independently enabled/disabled at runtime from the **Settings → Auth** page (no redeploy needed).

### How to use

**Local login** (frontend default):

```bash
curl -X POST http://localhost:8200/api/v1/auth/token \
  -d "username=admin@admin.com&password=admin"
```

**Get Entra login URL:**

```bash
curl http://localhost:8200/api/v1/auth/login
# → { "auth_url": "https://login.microsoftonline.com/.../authorize?..." }
```

**Refresh access token:**

```bash
curl -X POST http://localhost:8200/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "..."}'
```

### Use case: Mixed internal + external users

Your organization is on Microsoft 365 — every employee has an Entra identity. You enable Azure SSO so internal users log in via SSO with their work accounts (no extra password to manage). For your offshore contractor who isn't in your tenant, you create a local account with a strong password. Both end up with the same JWT and the same group-based permissions.

### Use case: Auto-provisioning new SSO users

Set `auto_create_users=true` in app settings. When a new Entra user logs in for the first time, a user record is created automatically with their email and display name. They land in the system with **zero permissions** until an admin assigns them to a group — safe by default.

---

## Group-Based Bucket Permissions

### What it does

Users belong to one or more **groups**. Each group has a list of **bucket permissions**, where each permission is:

- A **bucket pattern** (glob, evaluated with Python `fnmatch` — supports `*`, `?`, `[seq]`)
- Four boolean flags: `can_list`, `can_read`, `can_write`, `can_delete`

A user's effective permission for a bucket is the **union** of all matching permissions across all their groups. Admin users bypass all checks.

### How to use

From the UI: **Groups → New Group → Add Permission**.

```
Bucket pattern: logs-*
✓ List   ✓ Read   ✗ Write   ✗ Delete
```

This grants the group read-only access to every bucket whose name starts with `logs-`.

### Use case: Per-team isolated buckets

Naming convention: each team gets buckets prefixed with their team name (`marketing-assets`, `marketing-leads`, `engineering-builds`, etc.).

Create one group per team, give each group full permissions on `<team>-*`. New buckets matching the pattern are automatically accessible — no need to update permissions every time someone creates `marketing-campaign-q3`.

### Use case: Read-only auditor access

Create an `Auditors` group with pattern `*` and only `can_list` + `can_read`. Drop your compliance team into it. They can browse and download anything for review but cannot modify or delete.

---

## Bucket Management & Quotas

### What it does

Admins can create and delete buckets directly from the UI. Each bucket can carry an optional **size quota** (GB). Uploads that would push the bucket over its quota are rejected with HTTP 413.

A separate **global storage quota** (configured in Settings) caps total usage across all buckets.

Bucket names are validated against the AWS bucket naming spec: 3–63 chars, lowercase, digits, dots, hyphens only.

### How to use

Create a bucket with quota:

```bash
curl -X POST http://localhost:8200/api/v1/buckets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "marketing-assets", "quota_gb": 50}'
```

Browse contents:

```bash
curl "http://localhost:8200/api/v1/buckets/marketing-assets/browse?prefix=campaigns/2026/" \
  -H "Authorization: Bearer $TOKEN"
```

Delete:

```bash
curl -X DELETE http://localhost:8200/api/v1/buckets/marketing-assets \
  -H "Authorization: Bearer $TOKEN"
```

### Use case: Preventing one team from filling the disk

You're hosting a self-managed MinIO with 1TB of disk. Set the **global** quota to 900GB (leaves 10% headroom for the OS) and per-team bucket quotas of 100GB each. If the marketing team starts uploading raw 4K video, their uploads get cut off at 100GB instead of taking down storage for everyone else.

---

## Object Upload (Simple + Multipart)

### What it does

Two upload paths, automatically chosen by the frontend based on file size:

- **< 100MB → simple upload** — file POSTed to backend as `multipart/form-data`, backend writes to S3.
- **≥ 100MB → multipart upload via presigned URLs** — file split into 10MB parts (configurable). Backend issues presigned PUT URLs for each part; browser uploads parts **directly to S3/MinIO** (bypassing the backend), then backend finalizes the upload. Eliminates double bandwidth costs and the FastAPI request size limit.

Multipart flow:

1. `POST /api/v1/buckets/{name}/upload/init` — backend creates the multipart upload, returns N presigned URLs
2. Browser uploads each part via `PUT` directly to S3, captures the `ETag` from each response
3. `POST /api/v1/buckets/{name}/upload/complete` — backend finalizes with the ETag list

### How to use

Simple upload via UI: drag & drop into the bucket browser. The frontend handles routing to the right path.

Programmatic simple upload:

```bash
curl -X POST "http://localhost:8200/api/v1/buckets/my-bucket/objects?prefix=2026/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@report.pdf"
```

### Configuration

| Env variable                   | Default | Purpose                                                        |
|--------------------------------|---------|----------------------------------------------------------------|
| `PRESIGNED_URL_BASE`           | `""`    | External URL the browser uses to reach S3/MinIO (signs URLs against this host). **Required when backend and browser see storage at different hostnames.** |
| `MULTIPART_PART_SIZE_MB`       | `10`    | Part size for multipart uploads                                |
| `PRESIGNED_URL_EXPIRY_SECONDS` | `3600`  | Presigned URL lifetime                                         |

> **Why `PRESIGNED_URL_BASE` matters:** in Kubernetes the backend reaches MinIO via `http://minio.minio-ns.svc:9000` but the browser hits it via `https://minio.example.com`. Presigned URLs are bound to the host they were signed against — if the host doesn't match, S3/MinIO returns **403 SignatureDoesNotMatch**.

### Use case: Uploading a 4GB dataset

Data scientist uploads a 4GB Parquet file from their browser. The frontend calls `/upload/init`, gets back 410 presigned URLs (4GB ÷ 10MB), then uploads all 410 parts to MinIO in parallel (browsers handle 6 concurrent connections per host). Backend never touches the file payload — it only signs URLs and finalizes the manifest. Upload finishes in minutes instead of hours, and the FastAPI worker isn't tied up streaming gigabytes.

---

## Object Copy / Move

### What it does

Server-side copy via S3's `CopyObject` API — no data passes through the backend or the browser. Move = copy + delete source.

Cross-bucket and cross-prefix in one operation.

### How to use

UI: hover any object → click ⊞ to copy or ✂ to move → pick destination bucket and edit the destination key.

API:

```bash
# Copy
curl -X POST http://localhost:8200/api/v1/buckets/DEST/objects/copy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_bucket": "SRC",
    "source_key": "old/path/file.bin",
    "dest_key": "new/path/file.bin"
  }'

# Move (copy + delete source)
curl -X POST http://localhost:8200/api/v1/buckets/DEST/objects/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... same body ... }'
```

### Required permissions

- **Copy:** `read` on source bucket, `write` on destination
- **Move:** `read` + `delete` on source, `write` on destination

### Use case: Promoting build artifacts

CI uploads nightly builds to `builds-staging`. After QA approves a release, an operator clicks Move on the approved binary and sends it to `builds-production`. Server-side copy means a 2GB binary moves in seconds — no re-upload.

---

## Authenticated Image Proxy

### What it does

`GET /api/v1/images/{bucket}/{object_key}` streams an image from S3 through the backend, with:

- JWT authentication (same permission check as `read`)
- Content-type allow-list: `jpeg`, `png`, `gif`, `webp`, `svg`, `bmp`, `tiff`, `avif`. Anything else returns **415 Unsupported Media Type** — prevents the endpoint from being abused as a generic file proxy.
- `Cache-Control: public, max-age=3600` headers for browser caching
- Streaming response (no full buffer in memory)

Used by the in-app image preview modal so previews work even on private buckets.

### How to use

In the UI: click any image file → preview modal opens, fetching from `/api/v1/images/...` with the user's JWT.

Programmatic:

```bash
curl http://localhost:8200/api/v1/images/marketing-assets/logos/hero.png \
  -H "Authorization: Bearer $TOKEN" \
  -o hero.png
```

### Use case: Embedding images in an internal dashboard

You're building an internal Grafana-style dashboard and want to embed product photos pulled from a private S3 bucket. Rather than making the bucket public or wiring up presigned URLs that expire, the dashboard's frontend (already authenticated to s3BEAR) hits the image proxy directly:

```html
<img src="https://s3bear.example.com/api/v1/images/products/sku-12345.jpg"
     crossorigin="use-credentials" />
```

Permissions are enforced per-user, the URL never expires, and you get free browser caching.

---

## Public Share Links

### What it does

Turns any object in a private bucket into a **publicly accessible HTTPS URL** — no auth, no expiry token, no S3 ACL changes. Internally:

- `POST /api/v1/share/{bucket}/{key}` (authenticated, requires `read`) → returns a public URL
- `GET /api/v1/public/{bucket}/{object_key}` → streams the object with `Content-Disposition: inline` so browsers render it directly (images/PDFs) instead of forcing a download

The bucket itself stays private at the S3 level. s3BEAR is the only path that can serve the object publicly, so revoking access = deleting the object (or rotating the bucket).

### How to use

UI: open the **Share** modal on any file → click **Create share link** → copy the URL.

API:

```bash
# Create the share link (authenticated)
curl -X POST "http://localhost:8200/api/v1/share/marketing-assets/logos/hero.png" \
  -H "Authorization: Bearer $TOKEN"
# → { "url": "https://s3bear.example.com/api/v1/public/marketing-assets/logos/hero.png" }

# Anyone, no auth required
curl https://s3bear.example.com/api/v1/public/marketing-assets/logos/hero.png \
  -o hero.png
```

The returned URL is a stable, shareable HTTPS endpoint — paste it into emails, embed it in `<img>` tags, send it to external partners.

### Use case: Feeding images into an LLM as an HTTP source

Modern multimodal LLM APIs (Claude, GPT-4o, Gemini) accept images either as base64 payloads **or** as HTTP URLs. Base64 is simple but bloats your request size by ~33% and means you're shipping the same image bytes to the LLM on every call.

If your reference imagery sits in a private S3 bucket — product photos, screenshots, documentation diagrams — you can:

1. Click **Share** on the image in s3BEAR → get `https://s3bear.example.com/api/v1/public/products/sku-12345.jpg`
2. Pass that URL straight to the LLM:

```python
from anthropic import Anthropic

client = Anthropic()
response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "url",
                    "url": "https://s3bear.example.com/api/v1/public/products/sku-12345.jpg"
                }
            },
            {"type": "text", "text": "Describe what's wrong with this product photo."}
        ]
    }]
)
```

The LLM provider fetches the image from your s3BEAR endpoint over HTTPS. You don't expose the underlying S3 bucket, you don't ship base64 over the wire, and the same URL works for image previews in your frontend, image-to-image pipelines, and downstream RAG systems.

### Use case: Embedding files in external documents

A vendor needs the latest version of a spec sheet linked in their portal. Instead of emailing them a fresh PDF every time the file changes, share the s3BEAR public URL once. Update the file in the bucket → the URL serves the new version automatically. Delete the file → the link 404s.

### Use case: OG / preview images for marketing pages

Your CMS needs `og:image` URLs for social previews. Drop the assets into a `marketing-og` bucket, share-link them, paste into your CMS. No CDN setup, no separate hosting.

---

## Scheduled Cleanup Policies

### What it does

Admin-defined rules that automatically delete objects on a schedule. Each policy specifies:

- **Bucket patterns** — glob list (e.g., `["logs-*", "tmp-*"]`)
- **Prefix filter** — narrows the targeted keys (e.g., `archive/2024/`)
- **Older than days** — only delete objects whose `LastModified` is older than this
- **Cron expression** — when to run

Backed by APScheduler with a PostgreSQL job store, so jobs survive restarts. Each run records `last_run_at`, `last_run_status` (`success` / `partial` / `error`), and `last_run_deleted_count` for observability.

You can also trigger an ad-hoc run manually.

### How to use

UI: **Policies → New Policy**.

API:

```bash
# Create a policy: nightly delete files older than 30 days from any tmp-* bucket
curl -X POST http://localhost:8200/api/v1/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tmp-bucket-cleanup",
    "bucket_patterns": ["tmp-*"],
    "prefix_filter": null,
    "older_than_days": 30,
    "cron_expression": "0 3 * * *",
    "enabled": true
  }'

# Manual run
curl -X POST http://localhost:8200/api/v1/policies/{policy_id}/run \
  -H "Authorization: Bearer $TOKEN"
```

### Use case: GDPR-compliant log retention

Compliance says raw access logs older than 90 days must be purged. Create a policy: pattern `logs-access-*`, older-than `90`, cron `0 2 * * *` (2 AM daily). It deletes anything past the retention window every night, and the audit log captures each deletion run for your compliance auditors.

### Use case: Cleaning up CI build artifacts

Your CI pipeline drops a fresh artifact bundle into `builds-pr/` for every pull request. PRs close, branches die, the bucket grows forever. Policy: `builds-pr/*`, older-than `14`, weekly cron. Two weeks after a PR is merged, its artifacts evaporate.

---

## Audit Log

### What it does

Every state-changing operation is recorded in the `audit_logs` table with: timestamp, actor (user ID + email), action, bucket, object key, JSON details, and source IP.

| Action          | Trigger                              |
|-----------------|--------------------------------------|
| `upload`        | File uploaded (simple or multipart)  |
| `delete`        | Object(s) deleted                    |
| `copy`          | Object copied                        |
| `move`          | Object moved                         |
| `create_bucket` | New bucket created                   |
| `delete_bucket` | Bucket deleted                       |
| `user_create`   | User created (local or Entra import) |
| `user_delete`   | User deleted                         |
| `download`      | Presigned download URL issued        |

Optionally also written to a flat-file log on disk (configurable, with retention).

### How to use

UI: **Audit Log** in the sidebar. Filter by action / bucket / user / date range; expand a row for the full details JSON.

API (admin only):

```bash
curl "http://localhost:8200/api/v1/audit?action=delete&bucket=customer-data&page=1&page_size=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Use case: "Who deleted that file?"

A customer reports their onboarding PDF is missing from `customer-data`. Open the audit log, filter `action=delete` and `bucket=customer-data`, and you have the user, timestamp, and IP within seconds.

### Use case: Compliance evidence package

For ISO 27001 / SOC 2, auditors want to see access logs for sensitive buckets. Export the audit log filtered by bucket pattern as a CSV, attach to your evidence binder. The flat-file mirror gives you tamper-evident archival storage.

---

## Azure Entra User Import

### What it does

Search Azure AD by name or email and bulk-import matching users as s3BEAR accounts in one click. Imported users are linked by their Azure `oid`, so they get JWTs the moment they sign in via SSO — no password to set, no email to send.

### How to use

UI: **Users → Import from Entra → search → select → import**.

API:

```bash
# Search Entra for users matching "kemal"
curl "http://localhost:8200/api/v1/users/entra/search?q=kemal" \
  -H "Authorization: Bearer $TOKEN"

# Import selected users
curl -X POST http://localhost:8200/api/v1/users/entra/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"azure_oids": ["abc-123-...", "def-456-..."]}'
```

### Use case: Onboarding a new team

A new 8-person data team joins. Instead of asking each one to log in once so they appear in the system, search "Data Team" in Entra, import all 8 at once, drop them into the `Data Engineers` group with permissions on `data-*` buckets. They have access before their laptops are even unboxed.

---

## Troubleshooting

### Multipart upload returns 403

**Symptom:** Large file upload fails with `Request failed with status code 403` partway through.

- **Cause 1: `PRESIGNED_URL_BASE` not set.** URL signed against `minio:9000` (internal) but browser calls `localhost:9000` (external) → signature mismatch.

  **Fix:** Set `PRESIGNED_URL_BASE` to the externally-reachable URL.

- **Cause 2: CORS not configured on storage.** Browser preflight rejected.

  **Fix:** `MINIO_API_CORS_ALLOW_ORIGIN` (MinIO) or bucket CORS policy (S3) — see [CORS section](#minio--s3-cors-configuration).

### Multipart upload completes but file is corrupt

**Cause:** The frontend couldn't read `ETag` headers from part responses (CORS not exposing them), so it sent placeholders.

**Fix:** Ensure your CORS config has `ExposeHeaders: ["ETag"]`.

### Audit log page is empty

**Cause:** `audit_logs` table not migrated.

**Fix:**
```bash
# Docker Compose
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Kubernetes
kubectl exec -it deploy/s3bear-backend -- alembic upgrade head
```

### Copy / Move returns 403

**Cause:** Missing source `read` (and for move: `delete`) or destination `write` permission.

**Fix:** Check the user's effective permissions in **Groups** — both source and destination patterns must match a group the user belongs to.

### Image preview / share link returns 415

**Cause:** The object isn't a recognized image MIME type (image proxy is allow-listed by content-type).

**Fix:** This is intentional — the image proxy isn't a generic file server. For non-images, use [public share links](#public-share-links) instead.

### "User not approved" after Entra login

**Cause:** First-time SSO user, but `auto_create_users` is `false` (default).

**Fix:** Either flip `auto_create_users` to `true` in **Settings**, or pre-import the user via [Entra User Import](#azure-entra-user-import).
