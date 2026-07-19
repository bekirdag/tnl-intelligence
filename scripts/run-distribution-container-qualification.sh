#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS="$ROOT/.artifacts/tool-06"
IMAGE="tnl-intelligence:tool-06"
CONTAINER="tnl-tool-06-$$"
BUILDER="tnl-tool-06-builder-$$"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker image rm -f "$IMAGE" >/dev/null 2>&1 || true
  docker buildx rm -f "$BUILDER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$ROOT"
printf '%s\n' 'Tool 06: building the local non-root container...'
docker build -q -t "$IMAGE" . >/dev/null
docker image inspect "$IMAGE" >"$ARTIFACTS/container-image-inspect.json"

printf '%s\n' 'Tool 06: compiling linux/amd64 and linux/arm64 targets...'
docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
docker buildx build \
  --builder "$BUILDER" \
  --platform linux/amd64,linux/arm64 \
  --output type=cacheonly \
  --progress plain \
  . >"$ARTIFACTS/container-multiarch-build.log" 2>&1

printf '%s\n' 'Tool 06: generating the image SBOM and production-dependency vulnerability report...'
docker sbom \
  --format cyclonedx-json \
  --output "$ARTIFACTS/container-sbom.cdx.json" \
  "$IMAGE" >/dev/null
docker run --rm \
  --entrypoint npm \
  "$IMAGE" \
  audit --omit=dev --json >"$ARTIFACTS/container-vulnerabilities.json"

docker run -d \
  --name "$CONTAINER" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -p 127.0.0.1::7317 \
  -e TNL_API_KEY=tnl_test_key \
  "$IMAGE" >/dev/null
PORT_OUTPUT="$(docker port "$CONTAINER" 7317/tcp)"
PORT="${PORT_OUTPUT##*:}"
HEALTHY=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 0.25
done
if [[ "$HEALTHY" -ne 1 ]]; then
  printf '%s\n' 'Container health check did not become ready.' >&2
  exit 1
fi

node scripts/finalize-distribution-container-evidence.mjs
printf '%s\n' 'Tool 06 container qualification passed.'
