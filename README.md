# BPFLab

This repo holds the website, Jekyll blog, content, backend & userspace for BPFLab (formerly eBPF.party).

The website and blog use Persian and RTL layout throughout. C code, compiler/verifier logs, and technical diagrams retain isolated LTR direction for readability.

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

## Blog — blog.bpflab.ir

[`blog/`](blog/) is a separate Jekyll 4 site for **https://blog.bpflab.ir**, matching the website's dark blue/violet theme, glass cards, hexagon branding, and Vazirmatn font. Its responsive index displays post tiles with a cover image, title, summary, Jalali date, and Gravatar author image. Post pages include syntax-highlighted LTR code, reading time, tags, and older/newer navigation. There are no comments or analytics.

### Development and checks

Use Ruby 3.3+ and Bundler (install Bundler with `gem install bundler` if needed). Dependencies are pinned in `blog/Gemfile.lock`.

```bash
make blog-install       # install locked Ruby dependencies
make blog-dev           # http://localhost:4000, with live reload
make blog               # production static output: blog/_site/
make blog-test          # helper and generated-site regression tests
make blog-check         # production build, tests, Jekyll doctor
```

The blog is independent of TCC, the backend, KVM, and the existing Docker Compose services. The website's blog links use the production subdomain, including in local development.

### Publishing a post

Create `blog/_posts/YYYY-MM-DD-english-slug.md` with Persian content and front matter:

```yaml
---
title: "عنوان نوشته"
summary: "خلاصهٔ کوتاه برای کارت نوشته و توضیحات سئو."
date: 2026-10-11 10:00:00 +0330
author: "نام نویسنده <name@example.com>"
image: /assets/images/posts/my-post.webp
category: آموزش
tags: [eBPF, Linux]
---
```

Store cover images in `blog/assets/images/posts/`, ideally in a 16:9 ratio. If `image` is omitted, a themed placeholder is used. The three included posts are starter content you can edit or replace. Dates in filenames/front matter are Gregorian; the display is Jalali with Persian digits. Use fenced code blocks with a language (`c`, `bash`, etc.) and `<bdi>` or `dir="ltr"` for mixed-direction technical text. Drafts belong in `blog/_drafts/` and can be previewed with `cd blog && bundle exec jekyll serve --drafts`.

Each author is written as **`Name <email>`**. The plugin normalizes the email and hashes it for Gravatar, with an identicon fallback. SEO/RSS publish the display name, not the raw email. Gravatar hashes are not anonymization; obtain the author's consent. Google Fonts and Gravatar receive browser requests; see the blog's about page for the privacy notice. Custom helpers and the author validation live in `blog/_plugins/bpflab.rb`; builds must load plugins (no `--safe`).

### Deployment

Run `make blog` and deploy **only `blog/_site/`** to a static host for `blog.bpflab.ir`. Configure DNS for the subdomain and HTTPS on that host, serve directory `index.html` files, and return `404.html` with HTTP 404 for missing routes. `blog/_config.yml` sets canonical production URLs; `blog/CNAME` declares the custom hostname but does not create DNS records or deploy the site.

The output includes Atom feed (`/feed.xml`), sitemap (`/sitemap.xml`), and robots rules (`/robots.txt`). Jekyll's built-in GitHub Pages safe-mode build ignores the custom author/date plugin: use an external or CI Jekyll build and upload its generated output instead. DNS, TLS, and hosting configuration are deployment steps outside this repository.
