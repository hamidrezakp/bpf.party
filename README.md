# eBPF.party

This repo holds the website, content, backend & userspace for ebpf.party.

Exercise instructions are translated to Persian with RTL layout in the instruction pane. The code editor and home page remain LTR English.

## Quick start (Docker)

### Website only

```bash
docker compose up --build web
```

Open http://localhost:8080. This mode serves the website without starting the backend; code execution is unavailable. Requests to `/run_code/` and `/metrics` return HTTP 502 until the backend is running. Nginx resolves the optional backend through Docker DNS at request time, so its absence does not prevent the website from starting.

### Full stack (code execution)

Builds the patched `vmlinux`, backend, rootfs, and installs Firecracker from upstream GitHub releases inside the image. Requires Linux with KVM.

```bash
docker compose --profile full up --build
```

The first backend build can take a long time (kernel compile + Rust build).

To check nginx startup and proxying without building the website or the real backend, run:

```bash
./scripts/test-web-nginx.sh
```

This requires Docker and curl. It uses the website's nginx runtime image and cleans up its temporary containers and network.

## Local development

```bash
./scripts/fetch-artifacts.sh          # TCC WASM for browser typechecking
./scripts/build-vmlinux.sh            # optional if not using Docker backend
./scripts/build-backend-artifacts.sh  # optional host-side backend build
cd website && pnpm install && pnpm dev
```

See [`docker/artifacts/README.md`](docker/artifacts/README.md) for artifact details.
