#!/usr/bin/env bash
#
# s3BEAR release helper.
#
# Builds & pushes the backend/frontend images (multi-arch), packages & pushes
# the Helm chart to the OCI registry, bumps version files, tags the commit, and
# creates a GitHub release.
#
# Usage:
#   ./scripts/release.sh <version> [options]
#
# Examples:
#   ./scripts/release.sh 1.0.3
#   ./scripts/release.sh 1.0.3 --login                 # run `docker login` first
#   ./scripts/release.sh 1.0.3 --notes-file notes.md   # custom release notes
#   ./scripts/release.sh 1.0.3 --no-latest             # do not also push :latest
#   ./scripts/release.sh 1.0.3 --dry-run               # print steps, do nothing
#
set -euo pipefail

# ── Config (override with env vars) ───────────────────────────────────────────
DOCKER_NS="${DOCKER_NS:-bearcomp}"
BACKEND_IMAGE="${BACKEND_IMAGE:-$DOCKER_NS/s3bear-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-$DOCKER_NS/s3bear-frontend}"
HELM_OCI="${HELM_OCI:-oci://registry-1.docker.io/$DOCKER_NS}"
CHART_DIR="${CHART_DIR:-helm/s3bear}"
GH_REPO="${GH_REPO:-Cenkay1/s3BEAR}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILDER="${BUILDER:-s3bear-builder}"

# ── Args ──────────────────────────────────────────────────────────────────────
VERSION="${1:-}"
[ -z "$VERSION" ] && { echo "ERROR: version required. Usage: ./scripts/release.sh <version>"; exit 1; }
shift || true
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || { echo "ERROR: version must be semver, e.g. 1.0.3"; exit 1; }

DO_LOGIN=false; DO_LATEST=true; DRY_RUN=false; NOTES_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --login)      DO_LOGIN=true ;;
    --no-latest)  DO_LATEST=false ;;
    --dry-run)    DRY_RUN=true ;;
    --notes-file) NOTES_FILE="${2:-}"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

TAG="v$VERSION"
run() { echo "+ $*"; $DRY_RUN || "$@"; }

# ── Repo root ─────────────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."
echo "==> Repo: $(pwd)   Version: $VERSION   Latest: $DO_LATEST   Dry-run: $DRY_RUN"

# ── Preflight ─────────────────────────────────────────────────────────────────
for cmd in docker helm gh git; do command -v "$cmd" >/dev/null || { echo "ERROR: '$cmd' not found"; exit 1; }; done

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || echo "WARNING: you are on '$BRANCH', not 'main'."

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "ERROR: tag $TAG already exists locally. Bump the version or delete the tag."; exit 1
fi

echo "==> Pulling latest main"
run git pull --ff-only origin "$BRANCH" || true

if [ "$DO_LOGIN" = true ]; then
  echo "==> docker login"
  run docker login
fi

# Ensure a multi-arch buildx builder exists.
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "==> Creating buildx builder '$BUILDER'"
  run docker buildx create --name "$BUILDER" --use --bootstrap
else
  run docker buildx use "$BUILDER"
fi

# ── Bump version files ────────────────────────────────────────────────────────
echo "==> Bumping version files to $VERSION"
run perl -i -pe "s/^version:.*/version: $VERSION/; s/^appVersion:.*/appVersion: \"$VERSION\"/" "$CHART_DIR/Chart.yaml"
# values.yaml image tags (backend + frontend) -> $VERSION
run perl -0777 -i -pe "s/(s3bear-backend\s*\n\s*tag:\s*)\S+/\${1}$VERSION/; s/(s3bear-frontend\s*\n\s*tag:\s*)\S+/\${1}$VERSION/" "$CHART_DIR/values.yaml"

if ! git diff --quiet -- "$CHART_DIR"; then
  run git add "$CHART_DIR/Chart.yaml" "$CHART_DIR/values.yaml"
  run git commit -m "release: $TAG"
  run git push origin "$BRANCH"
fi

# ── Build & push images (multi-arch) ──────────────────────────────────────────
BE_TAGS=(-t "$BACKEND_IMAGE:$VERSION");  $DO_LATEST && BE_TAGS+=(-t "$BACKEND_IMAGE:latest")
FE_TAGS=(-t "$FRONTEND_IMAGE:$VERSION"); $DO_LATEST && FE_TAGS+=(-t "$FRONTEND_IMAGE:latest")

echo "==> Building & pushing backend image"
run docker buildx build --platform "$PLATFORMS" "${BE_TAGS[@]}" --push ./backend

echo "==> Building & pushing frontend image"
run docker buildx build --platform "$PLATFORMS" "${FE_TAGS[@]}" --push ./frontend

# ── Package & push Helm chart ─────────────────────────────────────────────────
echo "==> Packaging & pushing Helm chart"
run helm package "$CHART_DIR" --destination /tmp
run helm push "/tmp/s3bear-$VERSION.tgz" "$HELM_OCI"

# ── Tag & GitHub release ──────────────────────────────────────────────────────
echo "==> Tagging & creating GitHub release"
run git tag "$TAG"
run git push origin "$TAG"

if [ -n "$NOTES_FILE" ]; then
  run gh release create "$TAG" --repo "$GH_REPO" --title "$TAG" --notes-file "$NOTES_FILE"
else
  run gh release create "$TAG" --repo "$GH_REPO" --title "$TAG" --generate-notes
fi

echo ""
echo "==> Done. Released $TAG"
echo "    images:  $BACKEND_IMAGE:$VERSION , $FRONTEND_IMAGE:$VERSION$([ "$DO_LATEST" = true ] && echo ' (+latest)')"
echo "    chart:   $HELM_OCI/s3bear:$VERSION"
echo "    release: https://github.com/$GH_REPO/releases/tag/$TAG"
