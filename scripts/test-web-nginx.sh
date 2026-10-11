#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${NGINX_TEST_IMAGE:-nginxinc/nginx-unprivileged:1.30-alpine}"
CONFIG="${NGINX_TEST_CONFIG:-$ROOT/docker/nginx.conf}"
TMP="$(mktemp -d)"
TEST_CONFIG="$TMP/default.conf"
cp "$CONFIG" "$TEST_CONFIG"
chmod 755 "$TMP"
chmod 644 "$TEST_CONFIG"
NETWORK="bpf-party-nginx-test-$(basename "$TMP")"
WEB=""
BACKEND=""

cleanup() {
  if [ -n "$BACKEND" ]; then docker rm -f "$BACKEND" >/dev/null; fi
  if [ -n "$WEB" ]; then docker rm -f "$WEB" >/dev/null; fi
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# No backend DNS entry must be required to parse the web configuration.
docker run --rm --network none --entrypoint nginx \
  -v "$TEST_CONFIG:/etc/nginx/conf.d/default.conf:ro" "$IMAGE" -t

docker network create "$NETWORK" >/dev/null
mkdir "$TMP/html"
chmod 755 "$TMP" "$TMP/html"
printf 'website-only test\n' > "$TMP/html/index.html"
WEB="$(docker run -d --network "$NETWORK" -p 127.0.0.1::8080 \
  -v "$TEST_CONFIG:/etc/nginx/conf.d/default.conf:ro" \
  -v "$TMP/html:/usr/share/nginx/html:ro" "$IMAGE")"
URL="http://$(docker port "$WEB" 8080/tcp)"

for attempt in {1..50}; do
  if curl -fsS --max-time 2 "$URL/" > "$TMP/response" 2>/dev/null; then break; fi
  sleep 0.1
done
grep -qx 'website-only test' "$TMP/response"
status="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$URL/chapter/exercise")"
[ "$status" = 404 ] || { echo "Expected 404 for a missing static route, got $status" >&2; exit 1; }
curl -fsS --max-time 5 "$URL/healthz" | grep -qx 'ok'

for path in /metrics /run_code/test-exercise; do
  status="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$URL$path")"
  [ "$status" = 502 ] || { echo "Expected 502 without backend for $path, got $status" >&2; exit 1; }
done
curl -fsS --max-time 5 "$URL/" | grep -qx 'website-only test'

cat > "$TMP/backend.conf" <<'EOF'
server {
    listen 8081;
    location / {
        default_type text/plain;
        return 200 "$request_method $request_uri\n";
    }
}
EOF
BACKEND="$(docker run -d --network "$NETWORK" --network-alias backend \
  -v "$TMP/backend.conf:/etc/nginx/conf.d/default.conf:ro" "$IMAGE")"

# Retry through nginx's negative DNS cache, without restarting the web container.
for attempt in {1..20}; do
  if curl -fsS --max-time 2 "$URL/metrics?source=nginx-test" > "$TMP/response" 2>/dev/null; then break; fi
  sleep 1
done
grep -qx 'GET /metrics?source=nginx-test' "$TMP/response"
curl -fsS --max-time 5 -X POST --data 'test program' \
  "$URL/run_code/test-exercise?source=nginx-test" \
  | grep -qx 'POST /run_code/test-exercise?source=nginx-test'

echo 'PASS: web-only startup, static routes, absent-backend responses, and late-backend proxying'
