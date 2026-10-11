# AGENTS.md

Interactive eBPF tutorial: users write eBPF C in the browser, the backend compiles it with clang and runs it inside a Firecracker microVM, and results stream back over SSE. Setup and Docker usage: [README.md](README.md), [docker/artifacts/README.md](docker/artifacts/README.md).

## Layout

| Path | What it is |
|------|------------|
| `website/` | Astro 5 + React 19 + Tailwind 3 static site (pnpm). Landing page at `/` (Persian RTL), exercise list at `/exercises/`, how-it-works detail at `/how-it-works/`. Exercise UI, CodeMirror editor, in-browser TCC typecheck worker. |
| `backend/` | Rust HTTP server (`touche`, thread-based, no async). `POST /run_code/<exercise-id>` → clang → VM pool → SSE; `GET /metrics`. |
| `userspace/` | Rust guest `init` (`/main` in `rootfs.ext4`), static musl + libbpf. Loads the user's BPF object, runs the exercise workload, reports over vsock. |
| `shared/` | Host↔guest protocol (`HostMessage`, `GuestMessage`), `ExerciseId`, and `get_answer()`. bincode on vsock. |
| `backend/includes/` | Headers the user's program compiles against (`task.h` → precompiled `task.h.pch`, `ep_platform.h` defines `DEBUG_*` / `SUBMIT_*` macros). Also consumed by TCC via `tcc/em_include` symlink. |
| `tcc/` | Git submodule (TinyCC fork) built to WASM for browser syntax checking. |
| `bins/` | Tiny nolibc programs copied into the rootfs. |
| `verifier-provenance.patch` | Linux 6.18.2 patch that emits `DIAG1` lines in verifier logs; `backend/src/diag.rs` parses them into rustc-style diagnostics. |

The three Rust crates are **separate Cargo projects** (no workspace), each with its own `Cargo.lock`. `backend` depends on `../firecracker-spawn`, which is not in the repo — it is cloned and patched by `scripts/setup-firecracker-spawn.sh` (gitignored, along with `firecracker/`).

## Commands

- Website: `cd website && pnpm install && pnpm dev` (dev server talks to backend at `http://localhost:8081`, see `website/src/lib/api-client.ts`). Tests: `pnpm test` (vitest). Build: `pnpm build`.
- TCC WASM artifacts (needed by the editor): `./scripts/fetch-artifacts.sh` (requires `emcc`).
- Backend: `cd backend && cargo build --release`; runs from `backend/` reading `config.toml` (expects `./clang`, `../vmlinux`, `../rootfs.ext4`, hugepages, `/dev/kvm`).
- Userspace must target musl: `cd userspace && LIBBPF_SYS_EXTRA_CFLAGS="-idirafter /usr/include/x86_64-linux-gnu -idirafter /usr/include" cargo build --release --target x86_64-unknown-linux-musl`. Prefer `make rootfs.ext4` (needs `NOLIBC_INCLUDE`).
- Full host build: `./scripts/build-backend-artifacts.sh`. Full stack via Docker: `docker compose --profile full up --build` (slow: kernel compile).

## Tests

- `website/src/lib/struct-parser.test.ts` — the only frontend test.
- `backend/tests/diag_golden.rs` boots a real VM per fixture in `backend/tests/data/diag/*.bpf.c` and compares against `.golden` (raw `DIAG1` section) and `.rendered` (final diagnostic). Needs KVM, the patched `vmlinux` (override with `EBPF_PARTY_TEST_VMLINUX`), `rootfs.ext4`, and `./clang`. Regenerate with `UPDATE_GOLDEN=1`. If you can't run it, say so rather than hand-editing goldens.
- `backend/tests/dwarf_test.rs` uses the checked-in `tests/data/simple_stack.o`.

## Adding or changing an exercise

An exercise id is a kebab-case string that must match in **all** of these places:

1. `shared/src/lib.rs` — `ExerciseId` variant, `from_str`, `as_str`, and the expected answer in `get_answer()`.
2. `userspace/src/exercises.rs` — an `Exercise` impl (`setup` / `run` generate the activity the user's program must observe) and its arm in `get_exercise()`.
3. `website/src/lib/exercises-metadata.ts` — chapter entry with `slug`, `exerciseId`, `contentPath`, optional `codeFile`. This file (not the filesystem) drives routing and prev/next navigation.
4. `website/src/content/exercises/<chapter>/<slug>.mdx` — instructions.
5. `website/public/exercises-code/<chapter-number>/<codeFile>` — starter C code loaded into the editor.

Changing `shared` changes the wire protocol: rebuild **both** `userspace` (and the rootfs) and `backend`.

## Conventions and pitfalls

- Content language: exercise MDX, chapter/exercise titles, and the landing page are **Persian (RTL)**; keep eBPF/kernel terms, identifiers, and code in English. The editor UI stays LTR English.
- SSE payloads are serde-tagged `{ "type": camelCase, "data": ... }`. When editing `PlatformMessage` (`backend/src/types.rs`) or `GuestMessage` (`shared`), update `website/src/types/sse-events.ts` to match.
- Answers are derived from a random per-request `user_key`; user programs report them with `SUBMIT_*` macros from `ep_platform.h`.
- Editing `backend/includes/task.h` requires regenerating `task.h.pch` (backend does this on startup via `compile::pre_compile`) and rebuilding the TCC WASM data.
- Backend CORS only allows `http://localhost:*` / `http://127.0.0.1:*`; production goes through `docker/nginx.conf`, which proxies `/run_code/` and `/metrics` on the same origin.
- Rust edition 2024 in all crates. `.cargo/config.toml` patches `kvm-bindings` to Firecracker's fork.
