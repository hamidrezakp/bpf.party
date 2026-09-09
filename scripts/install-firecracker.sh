#!/usr/bin/env bash
set -euo pipefail

FC_VERSION="${FC_VERSION:-v1.16.1}"
PREFIX="${PREFIX:-/usr/local}"

case "$(uname -m)" in
  x86_64) ARCH="x86_64" ;;
  aarch64) ARCH="aarch64" ;;
  *)
    echo "install-firecracker: unsupported architecture $(uname -m)" >&2
    exit 1
    ;;
esac

TARBALL="firecracker-${FC_VERSION}-${ARCH}.tgz"
URL="https://github.com/firecracker-microvm/firecracker/releases/download/${FC_VERSION}/${TARBALL}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

mkdir -p "$PREFIX/bin"

echo "Downloading Firecracker ${FC_VERSION} for ${ARCH}..."
curl -fsSL "$URL" -o "$tmpdir/$TARBALL"
tar -xzf "$tmpdir/$TARBALL" -C "$tmpdir"

release_dir="$tmpdir/release-${FC_VERSION}-${ARCH}"
install -m 755 "$release_dir/firecracker-${FC_VERSION}-${ARCH}" "$PREFIX/bin/firecracker"
install -m 755 "$release_dir/jailer-${FC_VERSION}-${ARCH}" "$PREFIX/bin/jailer"

echo "Installed firecracker and jailer ${FC_VERSION} to ${PREFIX}/bin"
