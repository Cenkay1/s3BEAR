<div align="center">

# s3BEAR

**A secure S3 gateway: a web console for managing S3-compatible storage, an authenticated image-serving layer, and LLM-ready public hosting — in one platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688.svg)](#tech-stack)
[![Frontend](https://img.shields.io/badge/frontend-React_18-61dafb.svg)](#tech-stack)
[![Deploy](https://img.shields.io/badge/deploy-Docker%20%7C%20Helm-2496ed.svg)](#deployment)
[![Storage](https://img.shields.io/badge/storage-S3%20%2F%20MinIO-c72e49.svg)](#tech-stack)

</div>

---

## What is s3BEAR?

s3BEAR is a gateway and management console that sits in front of any S3-compatible
backend (AWS S3, MinIO, Ceph, Wasabi, and others). It addresses three needs in one place:

| # | Purpose | How |
|---|---------|-----|
| 1 | **S3 management console** | Manage buckets, objects, permissions, quotas, and cleanup policies from the web — no CLI or IAM console required. |
| 2 | **Authenticated image serving** | Serve images from private buckets to the browser without making the bucket public, while enforcing per-user permissions. |
| 3 | **LLM-ready public hosting** | Turn objects into stable HTTPS URLs that can be passed directly to multimodal LLM APIs (Claude, GPT-4o, Gemini) as image inputs. |

The storage layer stays **private at the S3 level**. s3BEAR is the single access path,
enforcing permission checks, audit logging, and quota limits.

---

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Request Flows](#request-flows)
- [Tech Stack](#tech-stack)
- [Quick Start (Docker Compose)](#quick-start-docker-compose)
- [Deployment](#deployment)
  - [Kubernetes (Helm)](#kubernetes-helm)
  - [Helm Values Reference](#helm-values-reference)
- [Feature Reference](#feature-reference)
- [API Surface](#api-surface)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [License](#license)

---

## Highlights

- **Group-based bucket permissions** — glob-pattern permissions (`marketing-*`) evaluated per action (`list`/`read`/`write`/`delete`); a user's effective permission is the union across all their groups.
- **Authenticated image proxy** — images in private buckets are streamed with a MIME allow-list and JWT permission checks.
- **On-the-fly image transformation** — resize/re-encode via query params (`?w=1024&format=webp&q=80`); ideal for handing right-sized images to LLMs. Available on both the image proxy and public share links.
- **Expiring, revocable public share links** — mint tokenized HTTPS URLs without making the bucket public; set an expiry or revoke at any time.
- **Multipart upload** — large files upload directly from the browser to S3 via presigned URLs, bypassing the backend.
- **Bulk operations** — multi-select copy/move/delete; each object is attempted independently and partial failures are reported.
- **Scheduled cleanup policies** — cron-based automatic object deletion, resilient across restarts (APScheduler + PostgreSQL job store).
- **Webhooks** — HMAC-signed HTTP callbacks on state-changing events, with per-endpoint event subscriptions, automatic retries with backoff, and a delivery log.
- **Audit logging** — every state-changing operation is recorded to the database (and optionally to JSONL files).
- **Azure Entra SSO** — MSAL/OIDC login and user import, with a local-account fallback.
- **Personal access tokens** — revocable, optionally expiring API tokens for scripts and CI; act as the owning user and work on every endpoint.
- **Bucket quotas** — per-bucket and global storage quotas, enforced with HTTP 413.

---

## Architecture

### System Overview

```mermaid
flowchart LR
    subgraph Client["Client"]
        UI["React 18 SPA<br/>(Ant Design + Zustand)"]
        LLM["LLM API<br/>(Claude / GPT-4o / Gemini)"]
        EXT["External consumers<br/>(browser, CMS, partners)"]
    end

    subgraph Gateway["s3BEAR Backend (FastAPI)"]
        direction TB
        MW["Middleware<br/>CORS · Security Headers · Rate Limit"]
        AUTH["Auth<br/>JWT (HS256) · MSAL"]
        API["API v1 Routers<br/>buckets · objects · images · share · policies · audit"]
        PERM["Permission Engine<br/>(glob + group union)"]
        SCHED["APScheduler<br/>cleanup worker"]
    end

    subgraph Data["Data Plane"]
        S3[("S3 / MinIO<br/>object storage")]
        PG[("PostgreSQL<br/>users · groups · policies · audit · share links · webhooks")]
    end

    UI -->|"JWT REST"| MW
    MW --> AUTH --> API --> PERM
    EXT -->|"public token URL (no auth)"| API
    LLM -->|"HTTPS GET image"| API
    PERM -->|"boto3 (async)"| S3
    API --> PG
    SCHED --> S3
    SCHED --> PG
    UI -. "multipart parts (presigned)" .-> S3
```

For large uploads the browser sends parts directly to S3/MinIO via presigned PUT URLs
(dashed line); the backend only signs URLs and finalizes the manifest. This removes the
double-bandwidth cost and the FastAPI request-size limit.

### Request Flows

**1) Authenticated image preview (private bucket)**

```mermaid
sequenceDiagram
    participant B as Browser (JWT)
    participant API as s3BEAR /images
    participant P as Permission Engine
    participant S3 as S3 / MinIO
    B->>API: GET /api/v1/images/{bucket}/{key}
    API->>P: can_read(user, bucket)?
    P-->>API: allowed
    API->>S3: stream_object()
    S3-->>API: bytes + content-type
    API-->>B: 200 image/* (MIME allow-listed, cached)
```

**2) LLM-ready public share link**

```mermaid
sequenceDiagram
    participant U as User (JWT)
    participant API as s3BEAR
    participant LLM as LLM Provider
    participant S3 as S3 / MinIO (private)
    U->>API: POST /api/v1/share/{bucket}/{key} { expires_in: "7d" }
    API-->>U: { token, url: /public/s/{token}, expires_at }
    Note over U,LLM: pass the URL to the LLM as an image source
    LLM->>API: GET /api/v1/public/s/{token} (no auth)
    API->>API: token valid and not expired/revoked?
    API->>S3: stream_object()
    S3-->>API: bytes
    API-->>LLM: 200 inline (bucket stays private; expired or revoked returns 410)
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2 · APScheduler · SlowAPI (rate limiting) · Pillow (image transforms) |
| **Frontend** | React 18 · TypeScript · Ant Design 5 · Zustand · Vite |
| **Database** | PostgreSQL (async `asyncpg` + a sync driver for Alembic) |
| **Auth** | Azure Entra ID (MSAL / OIDC) + JWT (HS256) + local accounts + personal access tokens |
| **Storage** | Any S3-compatible backend (AWS S3, MinIO, Ceph, Wasabi, ...) |
| **Deploy** | Docker Compose · Helm chart (OCI) · HPA · Nginx |

---

## Quick Start (Docker Compose)

```bash
cp .env.example .env   # fill in your credentials
docker compose -f docker-compose.dev.yml up -d
```

| Service       | URL                     |
|---------------|-------------------------|
| Frontend      | http://localhost:3100   |
| Backend API   | http://localhost:8200   |
| MinIO         | http://localhost:9000   |
| MinIO Console | http://localhost:9001   |
| PostgreSQL    | localhost:5432          |

Default admin: `admin@admin.com` / `admin` — **change this in production.**

For detailed setup, migrations, and CORS configuration, see **[HOW-TO.md](HOW-TO.md)**.

---

## Deployment

All images are published to Docker Hub:

```
bearcomp/s3bear-backend:1.0.0    # Backend image
bearcomp/s3bear-frontend:1.0.0   # Frontend image
bearcomp/s3bear:1.0.0            # Helm chart (OCI)
```

### Kubernetes (Helm)

**Option 1 — Full local stack (embedded PostgreSQL + MinIO)**, for development or demos:

```bash
helm install s3bear oci://registry-1.docker.io/bearcomp/s3bear --version 1.0.0 \
  --namespace s3bear --create-namespace \
  --set postgresql.enabled=true \
  --set minio.enabled=true \
  --set secrets.secretKey="your-secret-key-min-32-characters-long" \
  --set secrets.defaultAdminPassword="your-admin-password" \
  --set secrets.awsAccessKeyId="minioadmin" \
  --set secrets.awsSecretAccessKey="minioadmin" \
  --set config.awsEndpointUrl="http://minio:9000" \
  --set ingress.enabled=false \
  --set hpa.enabled=false \
  --set service.type=NodePort
```

Access via port-forward:

```bash
kubectl port-forward -n s3bear svc/s3bear-frontend 3200:80
kubectl port-forward -n s3bear svc/s3bear-backend 8200:8000
# open http://localhost:3200
```

**Option 2 — External PostgreSQL + external S3**, for production:

```bash
helm install s3bear oci://registry-1.docker.io/bearcomp/s3bear --version 1.0.0 \
  --namespace s3bear --create-namespace \
  --set postgresql.enabled=false \
  --set minio.enabled=false \
  --set secrets.secretKey="your-secret-key-min-32-characters-long" \
  --set secrets.databaseUrl="postgresql+asyncpg://user:pass@your-db-host:5432/s3bear" \
  --set secrets.databaseUrlSync="postgresql://user:pass@your-db-host:5432/s3bear" \
  --set secrets.awsAccessKeyId="YOUR_ACCESS_KEY" \
  --set secrets.awsSecretAccessKey="YOUR_SECRET_KEY" \
  --set config.awsRegion="eu-west-1" \
  --set ingress.host="s3bear.yourdomain.com"
```

**Option 3 — Mixed (embedded PostgreSQL + external S3):**

```bash
helm install s3bear oci://registry-1.docker.io/bearcomp/s3bear --version 1.0.0 \
  --namespace s3bear --create-namespace \
  --set postgresql.enabled=true \
  --set minio.enabled=false \
  --set secrets.secretKey="your-secret-key-min-32-characters-long" \
  --set secrets.awsAccessKeyId="YOUR_ACCESS_KEY" \
  --set secrets.awsSecretAccessKey="YOUR_SECRET_KEY" \
  --set config.awsRegion="us-east-1"
```

### Helm Values Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `postgresql.enabled` | `false` | Deploy embedded PostgreSQL |
| `minio.enabled` | `false` | Deploy embedded MinIO |
| `secrets.secretKey` | `change-me...` | JWT signing key (min 32 chars) |
| `secrets.databaseUrl` | `...postgres:5432/s3bear` | Async database URL |
| `secrets.databaseUrlSync` | `...postgres:5432/s3bear` | Sync database URL (for Alembic) |
| `secrets.awsAccessKeyId` | `""` | S3 access key |
| `secrets.awsSecretAccessKey` | `""` | S3 secret key |
| `secrets.defaultAdminEmail` | `admin@admin.com` | Initial admin email |
| `secrets.defaultAdminPassword` | `admin` | Initial admin password |
| `config.awsRegion` | `us-east-1` | AWS/S3 region |
| `config.awsEndpointUrl` | `""` | S3 endpoint (for MinIO/compatible) |
| `config.presignedUrlBase` | `""` | External S3 URL for browser uploads |
| `config.allowedOrigins` | `["https://..."]` | CORS allowed origins |
| `ingress.enabled` | `true` | Enable ingress |
| `ingress.host` | `s3bear.example.com` | Ingress hostname |
| `ingress.tls.enabled` | `false` | Enable TLS |
| `hpa.enabled` | `true` | Enable HorizontalPodAutoscaler |
| `auditLog.enabled` | `true` | Enable audit logging |
| `service.type` | `ClusterIP` | Service type (ClusterIP/NodePort/LoadBalancer) |

**Upgrade / Uninstall:**

```bash
helm upgrade s3bear oci://registry-1.docker.io/bearcomp/s3bear --version 1.1.0 \
  --namespace s3bear --reuse-values \
  --set image.backend.tag=1.1.0 --set image.frontend.tag=1.1.0

helm uninstall s3bear --namespace s3bear && kubectl delete namespace s3bear
```

---

## Feature Reference

| Feature | Summary |
|---------|---------|
| **Group-based permissions** | Glob-pattern bucket permissions across `list`/`read`/`write`/`delete`; effective permission is the union across a user's groups. Admins bypass all checks. |
| **Multipart upload** | Presigned URLs for large files; browser uploads directly to S3; configurable part size. |
| **Authenticated image proxy** | `GET /images/{bucket}/{key}` — JWT + MIME allow-list + streaming + browser caching. |
| **On-the-fly image transformation** | `?w=&h=&format=&q=&fit=` resize/re-encode via Pillow, on both the image proxy and public share links; source size capped by `MAX_IMAGE_TRANSFORM_MB`. |
| **Public share links** | Tokenized, expiring, revocable HTTPS URLs; the bucket stays private. Suited to LLMs, CMSs, and external partners. |
| **Object copy / move (+ bulk)** | Server-side via S3 `CopyObject`; cross-bucket and cross-prefix; move = copy + delete. Bulk copy/move/delete via multi-select, tolerant of partial failures. |
| **Cleanup policies** | Cron-scheduled automatic deletion with `older_than_days` and prefix filters; survives restarts. |
| **Audit logging** | Timestamp, actor, action, bucket, key, details, source IP; database plus optional JSONL. |
| **Azure Entra SSO + import** | OIDC login plus bulk user import from Entra; linked by `oid`. |
| **Bucket quotas** | Per-bucket and global storage quotas; HTTP 413 on breach. |

Real-world use cases and API examples for each feature are in **[HOW-TO.md](HOW-TO.md)**.

---

## API Surface

All endpoints are under `/api/v1`. Interactive OpenAPI docs are served at `http://<backend>/docs`.

| Router | Responsibility |
|--------|----------------|
| `auth` | Login (local + Entra), token refresh, callback |
| `tokens` | Personal access token (PAT) create/list/revoke |
| `buckets` | Bucket CRUD, listing/browsing, quotas |
| `objects` | Object listing, deletion, copy/move, bulk copy/move, presigned download |
| `upload` | Multipart init / complete, simple upload |
| `images` | Authenticated image proxy with optional on-the-fly transforms |
| `share` + `public` | Expiring/revocable tokenized public links (create/list/revoke) + unauthenticated serving at `/public/s/{token}` |
| `policies` | Cleanup policy CRUD and manual runs |
| `webhooks` | Webhook endpoint CRUD, delivery log, and test delivery (admin) |
| `users` / `groups` | User and group management, permission assignment, Entra import |
| `settings` | Runtime settings (auth toggles, auto-provisioning, quotas) |
| `audit` | Audit-log queries (filtering + pagination) |

---

## Configuration

Key environment variables (see `.env.example` for the full list):

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | — | JWT signing key (min 32 chars, required) |
| `DATABASE_URL` / `DATABASE_URL_SYNC` | localhost | Async / sync (Alembic) database connections |
| `AWS_ENDPOINT_URL` | `""` | S3 endpoint (for MinIO/compatible) |
| `PRESIGNED_URL_BASE` | `""` | External URL the browser uses to reach S3 (critical for multipart) |
| `MULTIPART_PART_SIZE_MB` | `10` | Multipart part size |
| `PRESIGNED_URL_EXPIRY_SECONDS` | `1800` | Presigned URL lifetime |
| `MAX_IMAGE_TRANSFORM_MB` | `25` | Source-size cap for on-the-fly image transforms (413 on breach) |
| `WEBHOOKS_ENABLED` | `true` | Enable webhook enqueue + dispatch |
| `WEBHOOK_MAX_ATTEMPTS` | `4` | Delivery attempts before a webhook is marked failed |
| `WEBHOOK_TIMEOUT_SECONDS` | `10` | Per-delivery HTTP timeout |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | `""` | Entra SSO credentials |
| `AUDIT_LOG_ENABLED` / `AUDIT_LOG_FILE_ENABLED` | `true` | Audit logging (database / file) |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | File audit retention |

---

## Roadmap

Planned and proposed features are tracked in **[docs/ROADMAP.md](docs/ROADMAP.md)**.

---

## Documentation

- **[HOW-TO.md](HOW-TO.md)** — feature-by-feature technical guide, use cases, and troubleshooting
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — planned and proposed features
- **OpenAPI** — `http://<backend>/docs` (Swagger UI) and `http://<backend>/redoc`

---

## Screenshots

**Bucket Panel**

<img width="1510" alt="Bucket Panel" src="https://github.com/user-attachments/assets/4710ebbb-058d-4a8a-982f-1523aeeb7122" />

**Policy Panel**

<img width="1512" alt="Policy Panel" src="https://github.com/user-attachments/assets/d6c3a324-1797-47ca-b549-63dd859f95d6" />

---

## License

MIT — see [LICENSE](LICENSE).
