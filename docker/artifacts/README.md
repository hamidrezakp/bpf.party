# Runtime artifacts (optional for local host builds)

The Docker backend image builds `vmlinux` and downloads Firecracker from upstream releases during `docker compose build`.

For local development without Docker:

```bash
./scripts/build-vmlinux.sh
./scripts/build-backend-artifacts.sh
./scripts/install-firecracker.sh   # optional; installs to /usr/local/bin
```

## Kernel

[`scripts/build-vmlinux.sh`](../scripts/build-vmlinux.sh) downloads Linux 6.18.2, applies [`verifier-provenance.patch`](../verifier-provenance.patch), merges [`docker/bpf-party-kernel.fragment`](../docker/bpf-party-kernel.fragment), and writes `docker/artifacts/vmlinux`.

## Firecracker binaries

[`scripts/install-firecracker.sh`](../scripts/install-firecracker.sh) installs `firecracker` and `jailer` from upstream Firecracker releases (default `v1.16.1`).

The backend uses the in-process VMM via `firecracker-spawn`; the release binaries are installed in the container for compatibility and debugging.

## Requirements

- Linux host with `/dev/kvm` for running VMs
- Backend container runs privileged with hugepages configured
