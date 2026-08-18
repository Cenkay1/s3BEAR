<div align="center">

# 🐻 s3BEAR

**Kurumsal S3 Gateway — güvenli web arayüzü, kimlik doğrulamalı görsel sunumu ve LLM-hazır public hosting tek platformda.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688.svg)](#tech-stack)
[![Frontend](https://img.shields.io/badge/frontend-React_18-61dafb.svg)](#tech-stack)
[![Deploy](https://img.shields.io/badge/deploy-Docker%20%7C%20Helm-2496ed.svg)](#deployment)
[![Storage](https://img.shields.io/badge/storage-S3%20%2F%20MinIO-c72e49.svg)](#tech-stack)

</div>

---

## What is s3BEAR?

s3BEAR, herhangi bir S3-uyumlu depolamanın (AWS S3, MinIO, Ceph, Wasabi …) önüne oturan bir **gateway** ve yönetim panelidir. Üç şeyi tek yerde çözer:

| # | Amaç | Nasıl |
|---|------|-------|
| 1 | **S3 Yönetim Arayüzü** | Bucket, obje, izin, kota ve temizlik politikalarını web üzerinden yönetin — komut satırı veya IAM konsolu gerekmez. |
| 2 | **Kimlik Doğrulamalı Görsel Sunumu** | Private bucket'lardaki görselleri, bucket'ı public yapmadan, kullanıcı izinlerini koruyarak web'de gösterin. |
| 3 | **LLM-Hazır Public Hosting** | Objeleri kalıcı HTTPS URL'lerine dönüştürün; bu URL'ler doğrudan çok-modlu LLM API'lerine (Claude, GPT-4o, Gemini) görsel girdisi olarak verilebilir. |

Depolama katmanı S3 seviyesinde **private kalır**. s3BEAR, izin denetimi, denetim kaydı (audit) ve kota uygulaması yapan tek erişim yoludur.

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

- 🔐 **Group-based bucket permissions** — glob desenli (`marketing-*`) izinler, `list/read/write/delete` bazında; kullanıcının efektif izni tüm gruplarının birleşimidir.
- 🖼️ **Authenticated image proxy** — private bucket'lardaki görseller, MIME allow-list ve JWT denetimiyle stream edilir.
- 🌐 **Public share links (LLM-ready)** — bucket'ı public yapmadan kalıcı HTTPS URL üretin.
- ⬆️ **Multipart upload** — büyük dosyalar tarayıcıdan doğrudan S3'e (presigned URL), backend'i baypas ederek yüklenir.
- 🗓️ **Scheduled cleanup policies** — cron tabanlı otomatik obje silme; restart'a dayanıklı (APScheduler + PostgreSQL job store).
- 📋 **Audit logging** — her durum-değiştiren işlem DB'ye (+ opsiyonel JSONL) kaydedilir.
- 🏢 **Azure Entra SSO** — MSAL OIDC + kullanıcı içe aktarma; yanında yerel hesap fallback.
- 📊 **Bucket quotas** — per-bucket ve global depolama kotaları (HTTP 413 ile sınırlama).

---

## Architecture

### System Overview

```mermaid
flowchart LR
    subgraph Client["🖥️ Client"]
        UI["React 18 SPA<br/>(Ant Design + Zustand)"]
        LLM["🤖 LLM API<br/>(Claude / GPT-4o / Gemini)"]
        EXT["🌍 External consumers<br/>(browser, CMS, partners)"]
    end

    subgraph Gateway["🐻 s3BEAR Backend (FastAPI)"]
        direction TB
        MW["Middleware<br/>CORS · Security Headers · Rate Limit"]
        AUTH["Auth<br/>JWT (HS256) · MSAL"]
        API["API v1 Routers<br/>buckets · objects · images · share · policies · audit"]
        PERM["Permission Engine<br/>(glob + group union)"]
        SCHED["APScheduler<br/>cleanup worker"]
    end

    subgraph Data["💾 Data Plane"]
        S3[("S3 / MinIO<br/>object storage")]
        PG[("PostgreSQL<br/>users · groups · policies · audit")]
    end

    UI -->|"JWT REST"| MW
    MW --> AUTH --> API --> PERM
    EXT -->|"public URL (no auth)"| API
    LLM -->|"HTTPS GET image"| API
    PERM -->|"boto3 (async)"| S3
    API --> PG
    SCHED --> S3
    SCHED --> PG
    UI -. "multipart parts (presigned)" .-> S3
```

> **Not — Multipart:** büyük yüklemelerde tarayıcı, presigned PUT URL'leriyle parçaları **doğrudan** S3/MinIO'ya gönderir (kesikli çizgi); backend yalnızca URL imzalar ve son manifesti onaylar. Bu, çift bant genişliği maliyetini ve FastAPI istek boyutu limitini ortadan kaldırır.

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
    P-->>API: ✔ allowed
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
    U->>API: POST /api/v1/share/{bucket}/{key}
    API-->>U: { url: https://.../public/{bucket}/{key} }
    Note over U,LLM: URL'i LLM isteğine image source olarak ekle
    LLM->>API: GET /api/v1/public/{bucket}/{key} (no auth)
    API->>S3: stream_object()
    S3-->>API: bytes
    API-->>LLM: 200 inline (bucket private kalır)
```

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| **Backend** | FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2 · APScheduler · SlowAPI (rate limit) |
| **Frontend** | React 18 · TypeScript · Ant Design 5 · Zustand · Vite |
| **Database** | PostgreSQL (async `asyncpg` + sync driver for Alembic) |
| **Auth** | Azure Entra ID (MSAL / OIDC) + JWT (HS256) + yerel hesaplar |
| **Storage** | Herhangi bir S3-uyumlu backend (AWS S3, MinIO, Ceph, Wasabi …) |
| **Deploy** | Docker Compose · Helm chart (OCI) · HPA · Nginx |

---

## Quick Start (Docker Compose)

```bash
cp .env.example .env   # kimlik bilgilerini doldur
docker compose -f docker-compose.dev.yml up -d
```

| Service       | URL                     |
|---------------|-------------------------|
| Frontend      | http://localhost:3100   |
| Backend API   | http://localhost:8200   |
| MinIO         | http://localhost:9000   |
| MinIO Console | http://localhost:9001   |
| PostgreSQL    | localhost:5432          |

Varsayılan admin: `admin@admin.com` / `admin` — **üretimde mutlaka değiştirin.**

> Ayrıntılı kurulum, migration ve CORS ayarları için → **[HOW-TO.md](HOW-TO.md)**

---

## Deployment

Tüm imajlar Docker Hub'da yayınlanır:

```
bearcomp/s3bear-backend:1.0.0    # Backend imajı
bearcomp/s3bear-frontend:1.0.0   # Frontend imajı
bearcomp/s3bear:1.0.0            # Helm chart (OCI)
```

### Kubernetes (Helm)

**Seçenek 1 — Tam yerel yığın (gömülü PostgreSQL + MinIO)** — geliştirme/demo için:

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

Port-forward ile erişim:

```bash
kubectl port-forward -n s3bear svc/s3bear-frontend 3200:80
kubectl port-forward -n s3bear svc/s3bear-backend 8200:8000
# http://localhost:3200
```

**Seçenek 2 — Harici PostgreSQL + Harici S3** — üretim için:

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

**Seçenek 3 — Karışık (gömülü PostgreSQL + harici S3):**

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
| `postgresql.enabled` | `false` | Gömülü PostgreSQL deploy et |
| `minio.enabled` | `false` | Gömülü MinIO deploy et |
| `secrets.secretKey` | `change-me...` | JWT imzalama anahtarı (min 32 karakter) |
| `secrets.databaseUrl` | `...postgres:5432/s3bear` | Async database URL |
| `secrets.databaseUrlSync` | `...postgres:5432/s3bear` | Sync database URL (Alembic için) |
| `secrets.awsAccessKeyId` | `""` | S3 access key |
| `secrets.awsSecretAccessKey` | `""` | S3 secret key |
| `secrets.defaultAdminEmail` | `admin@admin.com` | İlk admin e-postası |
| `secrets.defaultAdminPassword` | `admin` | İlk admin parolası |
| `config.awsRegion` | `us-east-1` | AWS/S3 bölgesi |
| `config.awsEndpointUrl` | `""` | S3 endpoint (MinIO/uyumlu için) |
| `config.presignedUrlBase` | `""` | Tarayıcı yüklemeleri için harici S3 URL |
| `config.allowedOrigins` | `["https://..."]` | CORS izinli originler |
| `ingress.enabled` | `true` | Ingress etkinleştir |
| `ingress.host` | `s3bear.example.com` | Ingress host adı |
| `ingress.tls.enabled` | `false` | TLS etkinleştir |
| `hpa.enabled` | `true` | HorizontalPodAutoscaler etkinleştir |
| `auditLog.enabled` | `true` | Audit logging etkinleştir |
| `service.type` | `ClusterIP` | Servis tipi (ClusterIP/NodePort/LoadBalancer) |

**Upgrade / Uninstall:**

```bash
helm upgrade s3bear oci://registry-1.docker.io/bearcomp/s3bear --version 1.1.0 \
  --namespace s3bear --reuse-values \
  --set image.backend.tag=1.1.0 --set image.frontend.tag=1.1.0

helm uninstall s3bear --namespace s3bear && kubectl delete namespace s3bear
```

---

## Feature Reference

| Özellik | Özet |
|---------|------|
| **Group-based permissions** | Glob desenli bucket izinleri; `list/read/write/delete`; gruplar arası birleşim. Admin tüm denetimleri baypas eder. |
| **Multipart upload** | Presigned URL'lerle büyük dosyalar; tarayıcı → S3 doğrudan; yapılandırılabilir parça boyutu. |
| **Authenticated image proxy** | `GET /images/{bucket}/{key}` — JWT + MIME allow-list + stream + browser cache. |
| **Public share links** | Objeyi kalıcı public HTTPS URL'ine çevirir; bucket private kalır. LLM/CMS/partner için ideal. |
| **Object copy / move** | S3 `CopyObject` ile server-side; cross-bucket & cross-prefix; move = copy + delete. |
| **Cleanup policies** | Cron zamanlı otomatik silme; `older_than_days` + prefix filtresi; restart'a dayanıklı. |
| **Audit logging** | Timestamp, actor, action, bucket, key, details, source IP; DB + opsiyonel JSONL. |
| **Azure Entra SSO + import** | OIDC login + Entra'dan toplu kullanıcı içe aktarma; `oid` bazlı eşleme. |
| **Bucket quotas** | Per-bucket ve global depolama kotası; aşımda HTTP 413. |

Her özelliğin gerçek-dünya kullanım senaryoları ve API örnekleri için → **[HOW-TO.md](HOW-TO.md)**

---

## API Surface

Tüm uçlar `/api/v1` altında. Interaktif OpenAPI dokümanı: `http://<backend>/docs`.

| Router | Sorumluluk |
|--------|-----------|
| `auth` | Login (yerel + Entra), token refresh, callback |
| `buckets` | Bucket CRUD, listeleme/gezinme, kota |
| `objects` | Obje listeleme, silme, copy/move, presigned download |
| `upload` | Multipart init / complete, simple upload |
| `images` | Kimlik doğrulamalı görsel proxy (MIME allow-list) |
| `share` + `public` | Public share link üretimi + auth'suz sunum |
| `policies` | Cleanup politikaları CRUD + manuel çalıştırma |
| `users` / `groups` | Kullanıcı & grup yönetimi, izin atama, Entra import |
| `settings` | Runtime ayarları (auth toggle, auto-provision, kotalar) |
| `audit` | Denetim kaydı sorgulama (filtre + sayfalama) |

---

## Configuration

Öne çıkan ortam değişkenleri (`.env.example` içinde tam liste):

| Değişken | Varsayılan | Amaç |
|----------|-----------|------|
| `SECRET_KEY` | — | JWT imzalama (min 32 karakter, zorunlu) |
| `DATABASE_URL` / `DATABASE_URL_SYNC` | localhost | Async / sync (Alembic) DB bağlantıları |
| `AWS_ENDPOINT_URL` | `""` | S3 endpoint (MinIO/uyumlu için) |
| `PRESIGNED_URL_BASE` | `""` | Tarayıcının S3'e eriştiği harici URL (multipart için kritik) |
| `MULTIPART_PART_SIZE_MB` | `10` | Multipart parça boyutu |
| `PRESIGNED_URL_EXPIRY_SECONDS` | `1800` | Presigned URL ömrü |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | `""` | Entra SSO kimlik bilgileri |
| `AUDIT_LOG_ENABLED` / `AUDIT_LOG_FILE_ENABLED` | `true` | Audit logging (DB / dosya) |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | Dosya audit saklama süresi |

---

## Roadmap

Geliştirme için değerlendirilen özellikler → **[docs/ROADMAP.md](docs/ROADMAP.md)**

---

## Documentation

- **[HOW-TO.md](HOW-TO.md)** — özellik-özellik teknik rehber, kullanım senaryoları, sorun giderme
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — planlanan / önerilen özellikler
- **OpenAPI** — `http://<backend>/docs` (Swagger UI) · `http://<backend>/redoc`

---

## Screenshots

**Bucket Panel**

<img width="1510" alt="Bucket Panel" src="https://github.com/user-attachments/assets/4710ebbb-058d-4a8a-982f-1523aeeb7122" />

**Policy Panel**

<img width="1512" alt="Policy Panel" src="https://github.com/user-attachments/assets/d6c3a324-1797-47ca-b549-63dd859f95d6" />

---

## License

MIT — see [LICENSE](LICENSE).
