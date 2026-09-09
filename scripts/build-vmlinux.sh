#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
KERNEL_VERSION="${KERNEL_VERSION:-6.18.2}"
KERNEL_MAJOR="${KERNEL_VERSION%%.*}"
BUILD_DIR="${BUILD_DIR:-$ROOT/.build/kernel}"
SRC_DIR="$BUILD_DIR/linux-$KERNEL_VERSION"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
OUTPUT="${OUTPUT:-$ROOT/docker/artifacts/vmlinux}"

mkdir -p "$BUILD_DIR" "$(dirname "$OUTPUT")"

if [ ! -d "$SRC_DIR" ]; then
  tarball="$BUILD_DIR/linux-$KERNEL_VERSION.tar.xz"
  if [ ! -f "$tarball" ]; then
    echo "Downloading Linux $KERNEL_VERSION..."
    curl -fsSL "https://cdn.kernel.org/pub/linux/kernel/v${KERNEL_MAJOR}.x/linux-${KERNEL_VERSION}.tar.xz" \
      -o "$tarball"
  fi
  echo "Extracting Linux $KERNEL_VERSION..."
  tar -xJf "$tarball" -C "$BUILD_DIR"
fi

echo "Applying verifier-provenance.patch..."
normalized_patch="$(mktemp)"
sed -e 's|--- .*verifier.c.orig|--- a/kernel/bpf/verifier.c|' \
    -e 's|+++ .*verifier.c|+++ b/kernel/bpf/verifier.c|' \
    "$ROOT/verifier-provenance.patch" > "$normalized_patch"
if ! patch -d "$SRC_DIR" -N -p1 --forward < "$normalized_patch"; then
  if [ ! -f "$SRC_DIR/.verifier-provenance-applied" ]; then
    echo "Failed to apply verifier-provenance.patch" >&2
    rm -f "$normalized_patch"
    exit 1
  fi
  echo "Patch already applied."
else
  touch "$SRC_DIR/.verifier-provenance-applied"
fi
rm -f "$normalized_patch"

cd "$SRC_DIR"
if [ ! -f .config ]; then
  echo "Generating kernel config..."
  make ARCH=x86_64 defconfig
  "$SRC_DIR/scripts/kconfig/merge_config.sh" -m -r -O "$SRC_DIR" \
    "$SRC_DIR/.config" "$ROOT/docker/bpf-party-kernel.fragment"
  make ARCH=x86_64 olddefconfig
fi

echo "Building vmlinux (this can take several minutes)..."
make ARCH=x86_64 -j"$JOBS" vmlinux

install -m 644 "$SRC_DIR/vmlinux" "$OUTPUT"
echo "Wrote $OUTPUT"
