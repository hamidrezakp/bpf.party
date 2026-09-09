#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$ROOT/docker/artifacts"
NOLIBC_INCLUDE="${NOLIBC_INCLUDE:-/tmp/nolibc-bpf-party}"

mkdir -p "$ARTIFACTS" "$NOLIBC_INCLUDE"
if [ ! -f "$NOLIBC_INCLUDE/nolibc.h" ]; then
  curl -fsSL https://github.com/torvalds/linux/archive/refs/tags/v6.18.tar.gz \
    | tar -xzf - -C "$NOLIBC_INCLUDE" --strip-components=4 linux-6.18/tools/include/nolibc
fi

./scripts/setup-firecracker-spawn.sh
./scripts/build-vmlinux.sh

echo "Building rootfs.ext4..."
make -C "$ROOT" rootfs.ext4 NOLIBC_INCLUDE="$NOLIBC_INCLUDE"

echo "Building userspace init..."
(cd "$ROOT/userspace" && LIBBPF_SYS_EXTRA_CFLAGS="-idirafter /usr/include/x86_64-linux-gnu -idirafter /usr/include" \
  cargo build --release --target x86_64-unknown-linux-musl)

echo "Building backend..."
(cd "$ROOT/backend" && cargo build --release)

cp "$ROOT/backend/target/release/backend" "$ARTIFACTS/backend"
cp "$ROOT/rootfs.ext4" "$ARTIFACTS/rootfs.ext4"

echo "Artifacts written to docker/artifacts/"
