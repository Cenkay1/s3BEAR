# s3BEAR

Secure S3 web panel with Azure Entra SSO, group-based permissions, multipart upload, audit logging, and cleanup policies.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL
- **Frontend:** React 18 + Ant Design 5 + Zustand
- **Auth:** Azure Entra (MSAL) + JWT (local accounts supported)
- **Storage:** Any S3-compatible backend (AWS S3, MinIO, etc.)

## Quick Start (Docker Compose)

```bash
cp .env.example .env   # fill in your credentials
docker compose -f docker-compose.dev.yml up -d
```

| Service       | URL                    |
|---------------|------------------------|
| Frontend      | http://localhost:3100   |
| Backend API   | http://localhost:8200   |
| MinIO         | http://localhost:9000   |
| MinIO Console | http://localhost:9001   |

Default admin: `admin@admin.com` / `admin`

---

## Kubernetes Deployment (Helm)

Docker images are available on Docker Hub:

```
bearcomp/s3bear-backend:1.0.0
bearcomp/s3bear-frontend:1.0.0
```

### Option 1: Full local stack (embedded PostgreSQL + MinIO)

For development, testing, or quick demos:

```bash
helm install s3bear ./helm/s3bear \
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
# Open http://localhost:3200
```

### Option 2: External PostgreSQL + External S3

For production or when connecting to existing infrastructure:

```bash
helm install s3bear ./helm/s3bear \
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

### Option 3: Mixed (embedded PostgreSQL + external S3)

```bash
helm install s3bear ./helm/s3bear \
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

### Upgrade

```bash
helm upgrade s3bear ./helm/s3bear --namespace s3bear --reuse-values \
  --set image.backend.tag=1.1.0 \
  --set image.frontend.tag=1.1.0
```

### Uninstall

```bash
helm uninstall s3bear --namespace s3bear
kubectl delete namespace s3bear
```

---

## Features

- **Group-based permissions** with glob pattern matching on bucket names (list/read/write/delete)
- **Multipart upload** via presigned URLs for large files (configurable part size)
- **Presigned download** URLs
- **Audit logging** to database + optional JSONL file output
- **Cleanup policies** with cron scheduling (auto-delete old objects)
- **Object copy/move** across buckets
- **Azure Entra SSO** with user import + local account fallback
- **Admin panel** for users, groups, permissions, policies, and audit logs

## License

MIT
