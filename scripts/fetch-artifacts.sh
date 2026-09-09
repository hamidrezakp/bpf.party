#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TCC_DIR="$ROOT/website/public/tcc"
WASM_DIR="$ROOT/website/src/wasm"
ARTIFACTS="$ROOT/docker/artifacts"

mkdir -p "$TCC_DIR" "$WASM_DIR" "$ARTIFACTS"

if [ ! -f "$WASM_DIR/syntax_check.mjs" ] || [ ! -f "$TCC_DIR/syntax_check.wasm" ]; then
  echo "Building TCC WASM (requires emscripten and clang)..."
  if ! command -v emcc >/dev/null 2>&1; then
    echo "ERROR: emcc not found. Install Emscripten or use docker compose to build the website."
    exit 1
  fi
  ln -sfn ../backend/includes "$ROOT/tcc/em_include"
  (cd "$ROOT/backend/includes" && clang -g -fpch-debuginfo -O2 -target bpf -x c-header task.h -o task.h.pch)
  (cd "$ROOT/tcc" && ./configure && bash embuild.sh)
  cp "$ROOT/tcc/syntax_check.mjs" "$WASM_DIR/syntax_check.mjs"
  cp "$ROOT/tcc/syntax_check.wasm" "$TCC_DIR/syntax_check.wasm"
  cp "$ROOT/tcc/syntax_check.data" "$TCC_DIR/syntax_check.data"
else
  echo "TCC WASM artifacts already present."
fi

if [ ! -f "$ARTIFACTS/vmlinux" ]; then
  echo ""
  echo "NOTE: docker/artifacts/vmlinux not built yet."
  echo "Run ./scripts/build-vmlinux.sh or use docker compose --profile full up --build."
else
  echo "Found docker/artifacts/vmlinux"
fi

echo "Done."
