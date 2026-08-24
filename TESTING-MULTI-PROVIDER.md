# Testing Multi-Provider Storage

s3BEAR can now front **several S3-compatible backends at once**. You register each
backend as a **Storage Provider**, and when you create a bucket you pick which
provider serves it. Every operation on that bucket (browse, upload, download,
share, resize, copy/move, delete) is routed to the right backend automatically.

This guide walks through proving it end-to-end using **two independent MinIO
instances** that ship with the dev stack.

---

## 1. Start the dev stack (now with a second MinIO)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3100 | admin@admin.com / _(see backend log)_ |
| Backend API | http://localhost:8200 | — |
| **MinIO #1** console | http://localhost:9001 | minioadmin / minioadmin |
| **MinIO #2** console | http://localhost:9011 | minioadmin / minioadmin |

> The admin password is generated on first run. Find it with:
> ```bash
> docker logs s3bear-backend-1 2>&1 | grep "Generated random admin password"
> ```

---

## 2. Register two providers

Log in, then go to **Settings → Storage → Storage Providers → Add Provider**.

**Provider A — "Local MinIO 1"**
- Type: `MinIO`
- Access Key ID: `minioadmin`
- Secret Access Key: `minioadmin`
- Region: `us-east-1`
- Endpoint URL: `http://minio:9000`
- Presigned URL Base: `http://localhost:9000`
- Click **Test** → should say *Connection successful* → **Add**

The first provider you add automatically becomes the **default** ⭐.

**Provider B — "Local MinIO 2"**
- Type: `MinIO`
- Access Key ID: `minioadmin`
- Secret Access Key: `minioadmin`
- Region: `us-east-1`
- Endpoint URL: `http://minio2:9000`
- Presigned URL Base: `http://localhost:9010`
- **Test** → **Add**

You should now see two provider cards, each showing its endpoint and a bucket count.

---

## 3. Create buckets on different providers

Go to **Buckets → Create Bucket**:

1. Name `alpha-on-one`, **Storage provider = Local MinIO 1** → Create.
2. Name `beta-on-two`, **Storage provider = Local MinIO 2** → Create.

Each bucket card now shows a **provider badge**.

**Verify the routing at the source of truth** — open both MinIO consoles:
- `alpha-on-one` exists **only** in MinIO #1 (http://localhost:9001).
- `beta-on-two` exists **only** in MinIO #2 (http://localhost:9011).

---

## 4. Upload and confirm isolation

1. Open `alpha-on-one` in s3BEAR and upload a file. It appears in **MinIO #1** only.
2. Open `beta-on-two` and upload a different file. It appears in **MinIO #2** only.

Image resize (`?w=...`), presigned share links, and downloads all follow the
same routing — they hit whichever backend owns the bucket.

---

## 5. Cross-provider copy/move (bonus)

Copy an object from `beta-on-two` into `alpha-on-one`. Because the two buckets
live on different backends, s3BEAR streams the object out of MinIO #2 and into
MinIO #1 for you (a server-side copy is used when both are on the same provider).

---

## 6. Default provider & deletion rules

- **Set default**: click the ☆ on any provider card. New buckets created without
  an explicit choice land on the default.
- **Delete guard**: a provider with buckets attached cannot be deleted — remove or
  reassign its buckets first. This prevents orphaning live storage.

---

## 7. Automated unit tests

Routing logic is covered by pure unit tests (no network needed):

```bash
docker compose -f docker-compose.dev.yml exec backend pytest tests/test_providers.py -v
```

They assert that: the env config is used when no providers exist, the first
provider becomes default, buckets route to their mapped provider, an explicit
`provider_id` overrides the map, stale mappings fall back to the default, and a
client built for a bucket targets that provider's endpoint.

---

## Notes & limitations

- **Bucket names are globally unique** across s3BEAR so a name alone routes
  unambiguously. Creating a name that already exists (on any provider) is rejected.
- Buckets created **directly** in a backend (outside s3BEAR) are still listed and
  are attributed to the provider they were discovered on.
- Cross-provider copy/move buffers the object through the gateway; for very large
  objects prefer keeping source and destination on the same provider.
- Legacy single-connection settings are migrated into a provider named **"Default"**
  on upgrade, so existing deployments keep working unchanged.
