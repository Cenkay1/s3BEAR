# s3BEAR performance benchmarks

This suite measures the cost of inserting s3BEAR between a client and an
S3-compatible object store. It intentionally reports the control and data
planes separately because most s3BEAR transfers use presigned URLs and do not
proxy object bytes.

See `benchmarks/RESULTS.md` for the first current-main local baseline and the
measured effect of the initial performance fixes.

## Download paths

| Path | Control plane | Data plane | What it answers |
| --- | --- | --- | --- |
| `direct` | Benchmark signs locally | Client to object store | Baseline without s3BEAR |
| `gateway-presigned` | One URL generated before the run | Client to object store | Whether the generated URL changes transfer performance |
| `gateway-presigned-e2e` | s3BEAR permission check and presign for every sample | Client to object store | User-visible cost of using s3BEAR |
| `gateway-share` | Share token resolved in PostgreSQL for every request | Object store to s3BEAR to client | Cost when every byte passes through s3BEAR |
| `--target NAME=URL` | Defined by the target | Target-defined | Comparison with another gateway or S3 frontend |

The report contains request rate, aggregate MiB/s, TTFB and total latency
distributions, failures, raw samples, and direct-baseline deltas. The E2E path
also reports a control-plane latency distribution. Target order is randomized
to reduce cache/run-order bias; the generated seed and execution order are
stored in every report. Pass `--seed` to reproduce an exact order.

## Quick start

The isolated stack uses ports `18200`, `19000`, and `19001`, avoiding the
normal development ports. Its credentials are fixed, local-only benchmark
credentials.

```bash
docker compose -f benchmarks/docker-compose.yml up -d --build backend

docker compose -f benchmarks/docker-compose.yml run --rm benchmark \
  python benchmarks/http_paths.py \
  --gateway-url http://backend:8000 \
  --s3-endpoint http://minio:9000 \
  --size-mib 16 \
  --requests 100 \
  --concurrency 10 \
  --warmup 5 \
  --output /results/16mib-c10.json
```

Run the focused runner tests with the same dependency image:

```bash
docker compose -f benchmarks/docker-compose.yml run --rm --no-deps benchmark \
  python -m unittest -v benchmarks.test_http_paths
```

Remove the isolated data after a campaign:

```bash
docker compose -f benchmarks/docker-compose.yml down --volumes
```

## Production target

The runner can also target an existing deployment. Keep secrets in environment
variables; they are not written to the JSON report.

```bash
export AWS_ACCESS_KEY_ID='...'
export AWS_SECRET_ACCESS_KEY='...'
export S3BEAR_BENCH_TOKEN='...'

python benchmarks/http_paths.py \
  --gateway-url https://s3bear.example.com \
  --s3-endpoint https://s3.example.com \
  --bucket s3bear-benchmark \
  --size-mib 128 \
  --requests 30 \
  --concurrency 10 \
  --output benchmarks/results/production-128mib-c10.json
```

Use a dedicated bucket and principal. The principal needs bucket read access,
and the runner needs object-store permission to create the bucket, upload the
fixture, inspect it, and generate the direct presigned URL. Use
`--skip-prepare` when the exact-size fixture already exists.

## Test matrix

Run every case at least three times with different generated seeds and compare
medians. A practical first campaign is:

| Object size | Concurrency | Requests per run | Dominant signal |
| ---: | ---: | ---: | --- |
| 1 MiB | 1, 10, 50 | 300 | Control plane, TTFB, request rate |
| 16 MiB | 1, 10, 50 | 100 | Typical transfer and concurrency |
| 128 MiB | 1, 10, 25 | 30 | Sustained throughput and backpressure |
| 1024 MiB | 1, 4 | 5 | Long-stream stability and memory |

Record s3BEAR commit, gateway/product version, CPU and memory limits, TLS mode,
network placement, object-store version, and whether caches are warm. Do not
compare runs with different durability, encryption, checksum, logging, or TLS
settings. Monitor client, s3BEAR, PostgreSQL, and object-store CPU, RSS, network
bytes, open connections, and disk I/O during each run.

Database concurrency is deployment-specific. The isolated benchmark profile
uses `DB_POOL_SIZE=32` and `DB_MAX_OVERFLOW=32`; production must keep the sum of
all replica pools below PostgreSQL's connection budget. The application defaults
remain the conservative `10+20`.

## Comparable products

Use the same fixture and client host. Product names should be treated as
architecture classes, not automatically as equivalent products:

| Comparison class | Examples | Interpretation |
| --- | --- | --- |
| Storage translation gateway | S3Proxy, VersityGW | Closest data-gateway comparison when configured over equivalent storage |
| Generic HTTP/S3 reverse proxy | Envoy, NGINX, HAProxy | Lower-bound proxy overhead; lacks s3BEAR authorization and management work |
| Independent S3 frontend/store | MinIO, Ceph RGW, SeaweedFS, Garage, CloudServer | Infrastructure reference only; backing store and consistency model differ |

Create or obtain a signed/public URL for the same-size object and add it as a
target. The URL may contain `=` characters.

```bash
python benchmarks/http_paths.py \
  --paths direct,gateway-presigned,gateway-presigned-e2e,gateway-share \
  --target s3proxy='https://gateway.example/bench/16mib.bin?...' \
  --target envoy='https://proxy.example/bench/16mib.bin?...'
```

Static external URLs measure the data path. If another product has a separate
authorization or signing API, measure that API independently or add an adapter
that performs its control request for every sample, as
`gateway-presigned-e2e` does for s3BEAR.

## Reading the result

Initial regression guardrails for a same-host lab are:

- zero failed or short responses;
- `gateway-presigned` aggregate throughput within 5% of `direct`;
- E2E control-plane p95 below 100 ms;
- for objects at least 16 MiB, E2E throughput within 10% of `direct`;
- stable proxy throughput and memory as concurrency rises, with no growing
  latency tail.

These are engineering starting points, not universal SLAs. Production budgets
must reflect network RTT, object-store latency, hardware, and expected object
sizes.

Use the metric pattern to choose the next change:

| Signal | Likely area | Candidate changes |
| --- | --- | --- |
| Presigned transfer differs from direct | DNS, TLS, URL host/style, storage routing | Make both URLs traverse the same network and TLS path; inspect redirects and signatures |
| E2E control time is high | Authentication, permission lookup, boto client construction, DB pool | Reuse S3 clients, profile DB queries, size pools, cache stable authorization data |
| Share TTFB is high | Token lookup, access-counter row lock, first object-store read | Check indexes and transaction duration; keep write locks out of the response stream |
| Share throughput falls with object size | Proxy stream loop, chunk size, thread pool, double network hop | Increase measured chunk size, remove per-chunk executor work, use redirect/offload or CDN where policy permits |
| Errors appear only at concurrency | Worker, thread, DB, socket, or file-descriptor limits | Inspect saturation metrics, then tune one constrained pool at a time |

Re-run the identical matrix after each change. Keep raw reports so an apparent
throughput gain cannot hide worse p95/p99 latency or errors.