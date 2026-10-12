.PHONY: all website_bindings website website-install website-dev website-check website-test website-format website-docker
.PHONY: blog blog-install blog-dev blog-check blog-test blog-docker

BUNDLE ?= bundle

NOLIBC_INCLUDE ?= /usr/src/linux/tools/include/nolibc
CFLAGS = -static -fno-ident -fno-asynchronous-unwind-tables -fno-unwind-tables -s -Os -nostdlib -I$(NOLIBC_INCLUDE) -include nolibc.h

all: website_bindings backend/includes/task.h.pch rootfs.ext4 backend/includes/kfuncs.h
	:
website_bindings: website/src/wasm/syntax_check.mjs website/public/tcc/syntax_check.data website/public/tcc/syntax_check.wasm
	:

website: website_bindings
	cd website && pnpm run build

website-install:
	cd website && pnpm install --frozen-lockfile

website-dev:
	cd website && pnpm dev

website-check:
	cd website && pnpm check

website-test:
	cd website && pnpm test

website-format:
	cd website && pnpm format

website-docker:
	docker compose build web

blog-install:
	cd blog && $(BUNDLE) install

blog-dev:
	cd blog && $(BUNDLE) exec jekyll serve --livereload

blog:
	cd blog && JEKYLL_ENV=production $(BUNDLE) exec jekyll build --strict_front_matter

blog-test:
	cd blog && $(BUNDLE) exec ruby -Itest test/blog_test.rb

blog-check: blog blog-test
	cd blog && $(BUNDLE) exec jekyll doctor

blog-docker:
	docker compose build blog

backend/includes/kfuncs.h:
	# generating this automatically requires a new pahole & bpftool
	# for now, grep works
	grep ^__bpf_kfunc ~/git/linux-6.18.2/kernel/bpf/helpers.c | grep bpf_str | sed -e 's/^__bpf_kfunc/extern/' -e 's/$$/ __ksym __weak;/' > $@

backend/includes/task.h.pch: backend/includes/task.h
	cd ./backend/includes && ../clang -g -fpch-debuginfo -O2 -target bpf -x c-header task.h -o task.h.pch

tcc/em_include:
	ln -s ../backend/includes/ tcc/em_include

tcc/config.h:
	cd tcc && ./configure

# tcc/em_include removed dep to speed up builds, need to debug
tcc/syntax_check.wasm: Makefile tcc/embuild.sh tcc/config.h tcc/*.c tcc/*.h tcc/em_include/*.h tcc/em_include/bpf/*.h
	cd tcc && EMCC_CFLAGS="-sINCOMING_MODULE_JS_API=locateFile,print,printErr,preRun" bash embuild.sh

website/src/wasm/syntax_check.mjs: tcc/syntax_check.wasm
	mkdir -p $(@D)
	cp tcc/syntax_check.mjs $@
website/public/tcc/syntax_check.data: tcc/syntax_check.wasm
	mkdir -p $(@D)
	cp tcc/syntax_check.data $@
website/public/tcc/syntax_check.wasm: tcc/syntax_check.wasm
	mkdir -p $(@D)
	cp tcc/syntax_check.wasm $@

rootfs:
	mkdir -p rootfs
rootfs/%: bins/%.c rootfs
	gcc $(CFLAGS) $< -o $@


rootfs/main: userspace/src/*.rs userspace/src/setup/*.rs
	cd userspace && LIBBPF_SYS_EXTRA_CFLAGS="-idirafter /usr/include/x86_64-linux-gnu -idirafter /usr/include" cargo build --release --target x86_64-unknown-linux-musl
	strip userspace/target/x86_64-unknown-linux-musl/release/userspace
	cp userspace/target/x86_64-unknown-linux-musl/release/userspace $@

rootfs/tmp:
	mkdir -p $@
rootfs/bin:
	mkdir -p $@
rootfs/sys:
	mkdir -p $@

rootfs.ext4: rootfs/exit_with_code rootfs/true rootfs/main rootfs/bin rootfs/sys rootfs/tmp
	truncate -s 16M $@
	mkfs.ext4 -q -F -d rootfs $@
	# The guest init (userspace/src/setup.rs) mounts sysfs on /sys and ramfs
	# on /bin and /tmp; a missing mountpoint makes PID 1 exit, which panics
	# the kernel ("Attempted to kill init") before the guest ever connects.
	# Assert the layout here so a forgotten prerequisite fails the build.
	debugfs -R 'ls -p /' $@ 2>/dev/null | grep -q '/tmp/' || { echo "ERROR: /tmp missing from $@" >&2; exit 1; }
