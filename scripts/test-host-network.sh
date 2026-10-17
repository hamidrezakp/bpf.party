#!/usr/bin/env bash
set -euo pipefail

# Test the real nginx runtime Dockerfile stages without rebuilding TCC/Jekyll.
# Requires Linux host networking, Docker, curl, and Python 3. No KVM needed:
# a mock backend checks proxy routing, methods, and query strings.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
SUFFIX="$(basename "$TMP" | tr '[:upper:]' '[:lower:]')"
WEB_IMAGE="bpflab-web-runtime-test:$SUFFIX"
BLOG_IMAGE="bpflab-blog-runtime-test:$SUFFIX"
NGINX_IMAGE="${NGINX_TEST_IMAGE:-nginxinc/nginx-unprivileged:1.30-alpine}"
WEB=""
BLOG=""
BACKEND=""

cleanup() {
  for container in "$BACKEND" "$BLOG" "$WEB"; do
    if [ -n "$container" ]; then docker rm -f "$container" >/dev/null; fi
  done
  docker image rm "$WEB_IMAGE" "$BLOG_IMAGE" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/docker" "$TMP/html/post"
chmod 755 "$TMP" "$TMP/html" "$TMP/html/post"
cp "$ROOT/docker/nginx.conf" "$ROOT/docker/nginx.blog.conf" "$TMP/docker/"
printf 'host-network test\n' >"$TMP/html/index.html"
printf 'post test\n' >"$TMP/html/post/index.html"
printf 'not found\n' >"$TMP/html/404.html"

for component in website blog; do
  awk '
    BEGIN { print "ARG NGINX_VERSION=1.30-alpine" }
    /^FROM nginxinc\/nginx-unprivileged:/ { runtime = 1 }
    runtime && !/^COPY --from=/ { print }
  ' "$ROOT/docker/Dockerfile.$component" >"$TMP/Dockerfile.$component"
done
docker build -q -f "$TMP/Dockerfile.website" -t "$WEB_IMAGE" "$TMP" >/dev/null
docker build -q -f "$TMP/Dockerfile.blog" -t "$BLOG_IMAGE" "$TMP" >/dev/null

# Reserve three distinct available ports, then release them just before startup.
read -r WEB_PORT BACKEND_PORT BLOG_PORT < <(
  python3 - <<'PY'
import socket
sockets = [socket.socket() for _ in range(3)]
for sock in sockets:
    sock.bind(("0.0.0.0", 0))
print(*(sock.getsockname()[1] for sock in sockets))
for sock in sockets:
    sock.close()
PY
)

wait_healthy() {
  local container="$1"
  for attempt in {1..100}; do
    if [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]; then
      return
    fi
    sleep 0.2
  done
  docker logs "$container" >&2
  echo "Container did not become healthy: $container" >&2
  return 1
}

# Defaults render correctly, including without a running backend. Exercise the
# image entrypoint rather than bypassing template rendering with --entrypoint.
docker run --rm --network none "$WEB_IMAGE" nginx -t
docker run --rm --network none "$BLOG_IMAGE" nginx -t

WEB="$(docker run -d --network host --health-interval=1s \
  -e WEB_PORT="$WEB_PORT" -e BACKEND_PORT="$BACKEND_PORT" \
  -v "$TMP/html:/usr/share/nginx/html:ro" "$WEB_IMAGE")"
BLOG="$(docker run -d --network host --health-interval=1s \
  -e BLOG_PORT="$BLOG_PORT" \
  -v "$TMP/html:/usr/share/nginx/html:ro" "$BLOG_IMAGE")"
wait_healthy "$WEB"
wait_healthy "$BLOG"

for container in "$WEB" "$BLOG"; do
  [ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container")" = host ]
  [ "$(docker inspect -f '{{len .HostConfig.PortBindings}}' "$container")" = 0 ]
done

URL="http://127.0.0.1:$WEB_PORT"
BLOG_URL="http://127.0.0.1:$BLOG_PORT"
curl -fsS "$URL/" | grep -qx 'host-network test'
curl -fsS "$BLOG_URL/" | grep -qx 'host-network test'
curl -fsS "$URL/healthz" | grep -qx 'ok'
curl -fsS "$BLOG_URL/healthz" | grep -qx 'ok'
for base in "$URL" "$BLOG_URL"; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$base/missing")"
  [ "$status" = 404 ]
done
curl -fsS -D "$TMP/headers" -o /dev/null "$BLOG_URL/post"
grep -qi '^Location: /post/' "$TMP/headers"

for path in /metrics /run_code/test-exercise; do
  status="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$URL$path")"
  [ "$status" = 502 ]
done

cat >"$TMP/backend.conf" <<EOF
server {
    listen 127.0.0.1:$BACKEND_PORT;
    location / {
        default_type text/plain;
        return 200 "\$request_method \$request_uri\n";
    }
}
EOF
chmod 644 "$TMP/backend.conf"
BACKEND="$(docker run -d --network host \
  -v "$TMP/backend.conf:/etc/nginx/conf.d/default.conf:ro" "$NGINX_IMAGE")"
for attempt in {1..50}; do
  if curl -fsS --max-time 2 "$URL/metrics?source=host-test" >"$TMP/response" 2>/dev/null; then break; fi
  sleep 0.1
done
grep -qx 'GET /metrics?source=host-test' "$TMP/response"
curl -fsS --max-time 5 -X POST --data 'test program' \
  "$URL/run_code/test-exercise?source=host-test" |
  grep -qx 'POST /run_code/test-exercise?source=host-test'

echo 'PASS: host networking, custom listener ports, health checks, blog redirects, and backend proxying'
