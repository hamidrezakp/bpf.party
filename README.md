# BPFLab

This repo holds the website, content, backend & userspace for BPFLab (formerly eBPF.party).

The website uses Persian and RTL layout throughout. C code, compiler/verifier logs, and technical diagrams retain isolated LTR direction for readability.

## Quick start (Docker)

### Website only

```bash
docker compose up --build web
```

Open http://localhost:8080. This mode serves the website without starting the backend; code execution is unavailable. Requests to `/run_code/` and `/metrics` return HTTP 502 until the backend is running. Nginx resolves the optional backend through Docker DNS at request time, so its absence does not prevent the website from starting.

### Full stack (code execution)

Builds the patched `vmlinux`, backend, rootfs, and installs Firecracker from upstream releases inside the image. Requires Linux with KVM.

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

### Website tooling

Use Node.js 22.12+ (22 or 24) and the pnpm version pinned in `website/package.json` (`corepack enable`).

```bash
make website-install   # reproducible dependency installation
make website-dev       # development server
make website-check     # Astro + TypeScript checks
make website-test      # unit/regression tests (non-watch mode)
make website-format    # Prettier, including Astro files
make website           # production build; requires Emscripten TCC artifacts
make website-docker    # build all website artifacts inside Docker
```

Saved code, editor settings, and progress are local to the browser. Unavailable or corrupt storage does not prevent using the editor. Debug output is limited to 1,000 events per run to keep the interface responsive; final answers and diagnostics are still shown.

The website Docker image builds and verifies the frontend before copying only static output into an unprivileged nginx runtime. Build arguments `EMSDK_VERSION`, `NODE_VERSION`, and `NGINX_VERSION` allow overriding base images (including digest-pinned references). `/healthz` checks nginx independently of the optional backend. Fingerprinted Astro assets are cached for a year; HTML and stable-name TCC artifacts are revalidated. Unknown static routes return 404 instead of the home page.
