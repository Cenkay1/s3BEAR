# s3BEAR — How To Guide

## Table of Contents

- [Local Development (Docker Compose)](#local-development-docker-compose)
- [MinIO / S3 CORS Configuration](#minio--s3-cors-configuration)
- [Presigned URL & Multipart Upload Setup](#presigned-url--multipart-upload-setup)
- [Audit Log](#audit-log)
- [Object Copy / Move](#object-copy--move)
- [Kubernetes Deployment (Helm)](#kubernetes-deployment-helm)
- [Troubleshooting](#troubleshooting)

---

## Local Development (Docker Compose)

### Prerequisites

- Docker & Docker Compose
- `.env` file in project root (copy from `.env.example`)

### Start

```bash
cp .env.example .env   # fill in Azure + AWS credentials
docker compose -f docker-compose.dev.yml up -d
```

### Services & Ports

| Service   | URL                        | Purpose              |
|-----------|----------------------------|----------------------|
| Frontend  | http://localhost:3100       | React UI             |
| Backend   | http://localhost:8200       | FastAPI API          |
| MinIO     | http://localhost:9000       | S3-compatible storage|
| MinIO Console | http://localhost:9001  | MinIO admin UI       |
| PostgreSQL| localhost:5432              | Database             |

### Default Admin Credentials

```
Email:    admin@admin.com
Password: admin
```

### Rebuild After Code Changes

```bash
# Backend only
docker build -t s3bear-backend:1.0.0 ./backend
docker compose -f docker-compose.dev.yml up -d backend

# Frontend only
docker build -t s3bear-frontend:1.0.0 ./frontend
docker compose -f docker-compose.dev.yml up -d frontend

# Both
docker build -t s3bear-backend:1.0.0 ./backend && \
docker build -t s3bear-frontend:1.0.0 ./frontend && \
docker compose -f docker-compose.dev.yml up -d
```

### Database Migrations

Migrations run automatically on container start via the `backend-migrate` init service.

To run manually:

```bash
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

---

## MinIO / S3 CORS Configuration

**This is required for multipart uploads to work.** The browser uploads file parts directly to MinIO/S3 via presigned URLs, so CORS must be configured on the storage layer.

### MinIO (Docker Compose — already configured)

The `docker-compose.dev.yml` includes the CORS environment variable:

```yaml
minio:
  environment:
    MINIO_API_CORS_ALLOW_ORIGIN: "*"
```

### MinIO (Kubernetes / Production)

Set the environment variable on your MinIO deployment:

```yaml
env:
  - name: MINIO_API_CORS_ALLOW_ORIGIN
    value: "https://s3bear.example.com"
```

Replace with your actual frontend domain. Use `*` only for development.

### AWS S3

For AWS S3, configure CORS on the bucket:

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

Apply via AWS CLI:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration file://cors.json
```

**Important:** The `ETag` header must be exposed — the frontend reads it from each part upload response to complete the multipart upload.

---

## Presigned URL & Multipart Upload Setup

### How It Works

1. Files < 100MB → simple upload (file goes through backend)
2. Files ≥ 100MB → multipart upload via presigned URLs:
   - Frontend calls `POST /api/v1/buckets/{name}/upload/init` → backend creates multipart upload on S3 and returns presigned URLs for each 10MB part
   - Frontend uploads parts directly to S3/MinIO (bypasses backend)
   - Frontend calls `POST /api/v1/buckets/{name}/upload/complete` → backend finalizes the upload

### Backend Configuration

| Env Variable              | Default | Description                                   |
|---------------------------|---------|-----------------------------------------------|
| `PRESIGNED_URL_BASE`      | `""`    | **Required for MinIO.** External URL that browsers can reach (e.g. `http://localhost:9000` for dev, `https://minio.example.com` for prod). If empty, falls back to `AWS_ENDPOINT_URL`. |
| `MULTIPART_PART_SIZE_MB`  | `10`    | Size of each upload part in MB                |
| `PRESIGNED_URL_EXPIRY_SECONDS` | `3600` | How long presigned URLs remain valid (seconds) |

### Why `PRESIGNED_URL_BASE` Is Needed

When running MinIO behind Docker/Kubernetes, the backend talks to MinIO via an internal hostname (`http://minio:9000`). But the browser needs to reach MinIO via an external URL (`http://localhost:9000` or `https://minio.example.com`).

Presigned URLs are signed against a specific endpoint. If the URL is signed for `minio:9000` but the browser calls `localhost:9000`, the signature won't match → **403 Forbidden**.

`PRESIGNED_URL_BASE` tells the backend to sign presigned URLs using the external URL so they work from the browser.

**Docker Compose example:**

```yaml
backend:
  environment:
    AWS_ENDPOINT_URL: http://minio:9000          # internal (backend → MinIO)
    PRESIGNED_URL_BASE: http://localhost:9000     # external (browser → MinIO)
```

**Kubernetes example:**

```yaml
backend:
  environment:
    AWS_ENDPOINT_URL: http://minio.minio-ns.svc:9000           # internal
    PRESIGNED_URL_BASE: https://minio.example.com               # external (via ingress)
```

### Signature Version

The backend uses **SigV4** for presigned URL signing. MinIO rejects SigV2 presigned URLs for multipart upload operations. This is handled automatically — no configuration needed.

---

## Audit Log

### Overview

All significant operations are logged to the `audit_logs` table with user, action, bucket, object key, details, and IP address.

### Logged Actions

| Action              | Trigger                        |
|---------------------|--------------------------------|
| `upload`            | File uploaded (simple or multipart) |
| `delete`            | Object(s) deleted              |
| `create_bucket`     | New bucket created             |
| `delete_bucket`     | Bucket deleted                 |
| `user_create`       | User created (local or Entra import) |
| `user_delete`       | User deleted                   |
| `copy`              | Object copied                  |
| `move`              | Object moved                   |

### Viewing Audit Logs

1. Login as admin
2. Navigate to **Audit Log** in the sidebar
3. Filter by action, bucket, or date range
4. Click the expand arrow on any row to see full details JSON

### API

```
GET /api/v1/audit?action=upload&bucket=my-bucket&page=1&page_size=50
```

Requires admin authentication.

---

## Object Copy / Move

### From the UI

1. Navigate to a bucket and find the file
2. Click the **copy** icon (⊞) to copy, or the **scissors** icon (✂) to move
3. Select destination bucket and edit the destination key/path
4. Click confirm

### From the API

**Copy:**
```bash
curl -X POST http://localhost:8200/api/v1/buckets/DEST_BUCKET/objects/copy \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_bucket":"SOURCE_BUCKET","source_key":"path/to/file.bin","dest_key":"new/path/file.bin"}'
```

**Move** (copy + delete source):
```bash
curl -X POST http://localhost:8200/api/v1/buckets/DEST_BUCKET/objects/move \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_bucket":"SOURCE_BUCKET","source_key":"path/to/file.bin","dest_key":"new/path/file.bin"}'
```

### Permissions Required

- **Copy:** `read` on source bucket, `write` on destination bucket
- **Move:** `read` + `delete` on source bucket, `write` on destination bucket

---

## Kubernetes Deployment (Helm)

### Install

```bash
helm install s3bear ./helm/s3bear \
  --namespace s3bear --create-namespace \
  --set secrets.secretKey="your-secret-key-min-32-chars" \
  --set secrets.databaseUrl="postgresql+asyncpg://user:pass@postgres:5432/s3bear" \
  --set secrets.databaseUrlSync="postgresql://user:pass@postgres:5432/s3bear" \
  --set secrets.awsAccessKeyId="AKID..." \
  --set secrets.awsSecretAccessKey="ASAK..." \
  --set config.awsEndpointUrl="http://minio.minio-ns.svc:9000" \
  --set config.presignedUrlBase="https://minio.example.com" \
  --set ingress.host="s3bear.example.com"
```

### Key Helm Values for New Features

```yaml
config:
  # Internal S3 endpoint (backend → storage)
  awsEndpointUrl: "http://minio.minio-ns.svc:9000"

  # External S3 URL (browser → storage) — REQUIRED for multipart upload
  presignedUrlBase: "https://minio.example.com"

  # Multipart upload tuning
  multipartPartSizeMb: "10"      # 10MB parts (default)
  presignedUrlExpiry: "3600"     # 1 hour (default)
```

### Production Checklist

- [ ] Set `secrets.secretKey` to a strong random string (≥32 chars)
- [ ] Use an external PostgreSQL (set `postgresql.enabled: false`)
- [ ] Configure `config.presignedUrlBase` to point to your externally-accessible S3/MinIO endpoint
- [ ] Configure CORS on your S3/MinIO to allow your frontend domain and expose `ETag`
- [ ] Set `config.allowedOrigins` to your frontend domain
- [ ] Enable TLS on ingress (`ingress.tls.enabled: true`)
- [ ] Set `secrets.defaultAdminPassword` to a strong password
- [ ] Configure Azure Entra secrets if using SSO

---

## Troubleshooting

### Multipart Upload Returns 403

**Symptom:** Large file upload fails with "Upload failed: Request failed with status code 403"

**Cause 1: Missing `PRESIGNED_URL_BASE`**
The presigned URL is signed with the internal MinIO hostname (e.g. `minio:9000`) but the browser calls the external hostname (e.g. `localhost:9000`). The signature doesn't match.

**Fix:** Set `PRESIGNED_URL_BASE` to the URL the browser uses to reach MinIO:
```
PRESIGNED_URL_BASE=http://localhost:9000   # dev
PRESIGNED_URL_BASE=https://minio.example.com  # prod
```

**Cause 2: CORS not configured on MinIO/S3**
The browser's preflight (OPTIONS) request is rejected, or the `ETag` header is not exposed.

**Fix:** Configure CORS on MinIO:
```yaml
MINIO_API_CORS_ALLOW_ORIGIN: "*"   # or your specific domain
```

For AWS S3, apply a CORS policy that exposes `ETag` (see [CORS section](#minio--s3-cors-configuration)).

### Multipart Upload Completes But File Is Corrupt

**Symptom:** Upload shows 100% but the file in S3 is broken.

**Cause:** `ETag` headers not being read correctly. Some S3-compatible services may not expose `ETag` in CORS responses.

**Fix:** Ensure your CORS configuration includes `ExposeHeaders: ["ETag"]`.

### Audit Log Page Is Empty

**Symptom:** No entries in the audit log after performing operations.

**Cause:** The `audit_logs` table may not exist (migration not run).

**Fix:**
```bash
# Docker Compose
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Kubernetes
kubectl exec -it deploy/s3bear-backend -- alembic upgrade head
```

### Copy/Move Returns 403

**Symptom:** Copy or move operation fails with permission error.

**Cause:** User doesn't have the required permissions on source and/or destination bucket.

**Fix:** Ensure the user's group has:
- Copy: `read` on source bucket, `write` on destination
- Move: `read` + `delete` on source, `write` on destination

Check permissions at **Groups** page in the admin UI.
