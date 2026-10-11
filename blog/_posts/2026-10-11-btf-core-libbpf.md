---
title: "BTF، CO-RE و libbpf: یک بار کامپایل، با شناخت محدودیت‌ها"
summary: "اطلاعات نوع BTF و relocationهای CO-RE چگونه اختلاف layout هسته‌ها را حل می‌کنند، و چرا این کار تضمین اجرای یک object روی هر لینوکس نیست؟"
date: 2026-10-11 16:00:00 +0330
author: "تیم BPFLab <help@bpflab.ir>"
image: /assets/images/posts/bpf-tooling.svg
category: ابزار و قابلیت انتقال
tags: [eBPF, BTF, CO-RE, libbpf, bpftool]
---

برنامهٔ tracing ممکن است فیلدی از `struct task_struct` را بخواند. مشکل این است که layout ساختارهای داخلی هسته، ABI پایدار فضای کاربر نیست: تغییر نسخه یا پیکربندی می‌تواند offset فیلد را عوض کند. hardcode کردن offset، برنامه را به یک build خاص وابسته می‌کند.

**BTF** و **CO-RE** بخش مهمی از راه‌حل‌اند، اما هرکدام مسئولیت مشخصی دارند.

## BTF چیست؟

**BPF Type Format** اطلاعات نوع‌ها را با نمایش فشرده نگه می‌دارد: struct، union، enum، pointer و دیگر نوع‌ها. در سیستم پشتیبان، BTF هسته معمولاً در `/sys/kernel/btf/vmlinux` در دسترس است.

این اطلاعات فقط برای خواندن structها نیست؛ tooling، introspection و بعضی attachmentهای مبتنی بر اطلاعات نوع نیز از آن استفاده می‌کنند. یک ID نوع در BTF شناسهٔ معنایی دائمی میان تمام buildها نیست.

```bash
bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h
```

این فرمان تعریف نوع‌ها را از BTF محیط موجود استخراج می‌کند. `vmlinux.h` جایگزین تمام هدرها، macroهای preprocessor یا APIهای هسته نیست؛ فایل BTF نمی‌تواند macroای را که در مرحلهٔ preprocessing حذف شده بازسازی کند.

## CO-RE کجا اتفاق می‌افتد؟

CO-RE مخفف **Compile Once – Run Everywhere** است. در جریان معمول، compiler علاوه بر دستورهای BPF، relocationهای مرتبط با دسترسی به نوع‌ها و فیلدها را ثبت می‌کند. `libbpf` هنگام load، آن اطلاعات را با BTF مقصد تطبیق می‌دهد و offsetها یا immediateهای مربوط را تنظیم می‌کند.

فقط داشتن `vmlinux.h` کافی نیست: دسترسی باید به شیوه‌ای انجام شود که relocationهای لازم تولید شوند. برای مثال، این **قطعهٔ برنامه** از macro مربوط به CO-RE استفاده می‌کند:

```c
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>

static __always_inline int read_parent_pid(struct task_struct *task)
{
    return BPF_CORE_READ(task, real_parent, tgid);
}
```

این تابع context یا attachment کامل ندارد و فرض می‌کند `task` از مسیر مجاز به دست آمده است. نام `tgid` در این مثال شناسهٔ thread group والد را می‌خواند؛ آن را با TID یک thread دلخواه یا شناسهٔ قابل‌نمایش در هر PID namespace یکی نگیرید. خطا و معنای مقدار بازگشتی نیز باید در کاربرد واقعی بررسی شوند.

## CO-RE چه چیزی را حل نمی‌کند؟

| مسئله | توان CO-RE |
|---|---|
| تغییر offset فیلدی با تعریف قابل‌تطبیق | هدف اصلی relocationهای field |
| بررسی وجود نوع یا فیلد | با primitiveهای وجودسنجی و fallback طراحی‌شده |
| نبودن helper یا نوع map مورد نیاز | قابلیت را به هسته اضافه نمی‌کند |
| حذف تابع هدف یا تغییر معنای hook | تطبیق layout کافی نیست |
| نبودن مجوز load/attach | تغییری در مدل دسترسی نمی‌دهد |
| تفاوت endianness یا ABI معماری در کد حساس | نیازمند انتخاب هدف و طراحی مناسب |

وجود فیلد هم به‌تنهایی معنای آن را ثابت نمی‌کند. برنامه باید بازهٔ هسته‌های پشتیبانی‌شده و رفتار در نبود قابلیت را تعریف کند؛ عبارت «همه‌جا» شعار هدف طراحی است، نه قرارداد بدون شرط.

## skeleton چه کمکی می‌کند؟

`bpftool` می‌تواند از object یک skeleton برای برنامهٔ C فضای کاربر بسازد:

```bash
bpftool gen skeleton example.bpf.o > example.skel.h
```

skeleton کد و رابط‌هایی برای open، load، دسترسی به mapها و attach تولید می‌کند. این کار، glue code تکراری را کم می‌کند؛ اما خطاهای load، lifecycle و policy انتخاب hook را از برنامهٔ شما حذف نمی‌کند. بعضی sectionها و attachmentها نیز به تنظیم یا attach صریح نیاز دارند.

برای نمونهٔ پروژهٔ کامل و ابزارها، **libbpf-bootstrap** مرجع خوبی است. برای ساخت تولیدی، نسخهٔ compiler، libbpf، object و هسته‌های آزمایش‌شده را ثبت کنید؛ صرفاً object و header را کپی نکنید و امیدوار نباشید که target هرچه بود کار کند.

در [چرخهٔ اجرای eBPF]({% post_url 2026-10-11-ebpf-program-lifecycle %}) جای relocation، load و attach را جدا کردیم. در [چک‌لیست عملیاتی]({% post_url 2026-10-11-ebpf-production-checklist %}) این جداسازی به یک روش عیب‌یابی تبدیل می‌شود.

## منابع

- [مستندات رسمی BTF در هسته](https://docs.kernel.org/bpf/btf.html)
- [مستندات relocationهای LLVM و CO-RE](https://docs.kernel.org/bpf/llvm_reloc.html)
- [مستندات CO-RE در libbpf](https://docs.kernel.org/bpf/libbpf/libbpf_naming_convention.html)
- [پروژهٔ رسمی libbpf-bootstrap و نمونه‌های کامل](https://github.com/libbpf/libbpf-bootstrap)
- [دستور gen skeleton در bpftool](https://github.com/libbpf/bpftool/blob/main/docs/bpftool-gen.rst)
