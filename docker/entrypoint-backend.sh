#!/usr/bin/env bash
set -euo pipefail

if [ ! -f /app/vmlinux ]; then
  echo "ERROR: /app/vmlinux not found in image." >&2
  exit 1
fi

if [ ! -f /app/rootfs.ext4 ]; then
  echo "ERROR: /app/rootfs.ext4 not found in image." >&2
  exit 1
fi

REQUIRED_HUGEPAGES="${REQUIRED_HUGEPAGES:-128}"
CURRENT="$(cat /proc/sys/vm/nr_hugepages 2>/dev/null || echo 0)"

if [ "$CURRENT" -lt "$REQUIRED_HUGEPAGES" ]; then
  echo "Setting vm.nr_hugepages to ${REQUIRED_HUGEPAGES} (was ${CURRENT})"
  echo "$REQUIRED_HUGEPAGES" > /proc/sys/vm/nr_hugepages
fi

exec /usr/local/bin/backend /app/config.toml
