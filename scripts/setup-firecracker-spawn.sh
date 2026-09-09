#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPAWN_DIR="$ROOT/firecracker-spawn"
FC_DIR="$ROOT/firecracker"
FC_BRANCH="${FC_BRANCH:-serial-only}"

if [ ! -d "$SPAWN_DIR/.git" ]; then
  git clone --depth 1 https://github.com/DavidVentura/firecracker-spawn "$SPAWN_DIR"
fi

if [ ! -d "$FC_DIR/.git" ]; then
  git clone --depth 1 --branch "$FC_BRANCH" https://github.com/DavidVentura/firecracker "$FC_DIR"
fi

cp "$ROOT/docker/firecracker-spawn.Cargo.toml" "$SPAWN_DIR/Cargo.toml"
"$ROOT/scripts/patch-firecracker.sh" "$FC_DIR"
"$ROOT/scripts/patch-firecracker-spawn.sh" "$SPAWN_DIR"
echo "firecracker-spawn ready (firecracker branch: $FC_BRANCH)"
