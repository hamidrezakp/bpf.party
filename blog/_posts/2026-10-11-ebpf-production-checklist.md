---
title: "از نمونهٔ آزمایشگاهی تا ابزار عملیاتی eBPF: چک‌لیست استقرار"
summary: "بررسی قابلیت هسته با bpftool، بودجهٔ CPU و حافظه، lifecycle، حریم خصوصی و rollback؛ نکاتی که خارج از کد BPF تعیین‌کننده‌اند."
date: 2026-10-11 18:00:00 +0330
author: "تیم BPFLab <help@bpflab.ir>"
image: /assets/images/posts/bpf-tooling.svg
category: عملیات و رفع اشکال
tags: [eBPF, bpftool, production, observability]
---

یک نمونهٔ BPF که روی لپ‌تاپ کار می‌کند، هنوز ابزار آمادهٔ محیط عملیاتی نیست. تفاوت نسخه و تنظیمات هسته، حجم رویداد، عمر objectها و دسترسی به دادهٔ حساس می‌توانند نتیجه را تغییر دهند.

این چک‌لیست برای ساخت ابزار ردیابی یا شبکه است؛ هدف آن دور زدن محدودیت‌ها یا اجرای دستورهای تغییردهنده روی میزبان بدون شناخت نیست.

## ۱. نیازها را دقیق بنویسید

به‌جای «Linux جدید»، فهرست قابلیت‌ها را مشخص کنید: نوع برنامه، hook، map، helper، BTF، شیوهٔ attachment و امکانات معماری. یک نسخهٔ جدید ممکن است با config مناسب build نشده باشد؛ یک هستهٔ توزیع قدیمی‌تر هم ممکن است بعضی قابلیت‌ها را backport کرده باشد.

با نسخهٔ مناسب `bpftool`، این فرمان‌ها برای مشاهدهٔ محیط مفیدند:

```bash
uname -r
bpftool version
sudo bpftool feature probe kernel
sudo bpftool prog show
sudo bpftool map show
sudo bpftool link show
```

فرمان `feature probe` برای سنجش قابلیت‌ها ممکن است objectهای موقت آزمایشی بسازد، اما این مجموعه قرار نیست policy شبکه یا امنیت جدیدی attach کند. عملیات introspection هم ممکن است مجوز بخواهد و در محیط حساس باید طبق رویهٔ همان محیط اجرا شود.

ناتوانی در probe همیشه به معنی نبود قابلیت نیست؛ مجوز، محدودیت container یا policy هسته نیز می‌تواند علت باشد. BTF و config هدف را مستقل بررسی کنید. `prog show` هم به‌تنهایی برای تشخیص attachment کافی نیست؛ بعضی اتصال‌های قدیمی یا subsystem-specific در قالب BPF link نیستند.

## ۲. شکست را به مرحلهٔ درست نسبت دهید

| نشانه | پرسش مناسب |
|---|---|
| خطای compiler | هدف BPF، includeها و نوع‌ها درست‌اند؟ |
| خطای CO-RE | BTF مقصد و فیلد مورد نیاز وجود دارند؟ |
| خطای map create | نوع map، ظرفیت، مجوز و بودجهٔ حافظه درست‌اند؟ |
| رد وریفایر | log کامل چه مسیر یا محدودیتی را نشان می‌دهد؟ |
| خطای attach | hook، interface یا symbol مقصد معتبر است؟ |
| اجرای بدون خروجی | رویداد واقعاً رخ می‌دهد و filter درست است؟ |
| خروجی ناقص | drop، unmatched event یا مشکل consumer وجود دارد؟ |

log خطا را همراه با نسخهٔ object، toolchain، libbpf و مشخصات target ثبت کنید. حذف `NULL` check یا عوض کردن نوع cast برای ساکت کردن خطا، جای تحلیل علت را نمی‌گیرد.

## ۳. حافظه را با تعداد CPUها و کلیدها حساب کنید

mapِ per-CPU روی سرور با CPUهای ممکن زیاد، هزینهٔ متفاوتی نسبت به لپ‌تاپ دارد. تعداد کلیدهای hash، رکوردهای entry/exit و اندازهٔ ring نیز باید سقف داشته باشند.

سناریوهای فشار را آزمایش کنید: مصرف‌کنندهٔ کند، churn شناسه‌ها، خطای درج، حذف نشدن کلید و restart loader. محدودیت حسابداری حافظه بسته به هسته و محیط می‌تواند به memlock یا memory cgroup مربوط باشد؛ افزایش بی‌قید limit را راه‌حل عمومی فرض نکنید.

## ۴. مشاهده‌گر را هم مشاهده کنید

حداقل metricهای زیر را برای خود ابزار داشته باشید:

- نرخ فراخوانی و تعداد رکوردهای تولیدشده؛
- شکست map update و output؛
- دادهٔ unmatched و خطای decode؛
- backlog یا تأخیر consumer؛
- CPU و حافظهٔ loader و تغییر latency سرویس هدف.

آزمون baseline، ابزار فعال با filter محدود و سپس بار نزدیک اوج، کمک می‌کند اثر واقعی معلوم شود. benchmarkِ packet processing یا tracing را بدون ذکر workload، قابلیت‌های NIC و شکل جمع‌آوری داده تعمیم ندهید.

## ۵. lifecycle و rollback را طراحی کنید

مشخص کنید بسته شدن loader چه اثری بر attachment دارد. BPF link، pin، map و روش‌های قدیمی اتصال عمر یکسانی ندارند. pin شدن object در bpffs باعث نمی‌شود داده پس از reboot مثل فایل پایدار بازیابی شود.

برای نسخهٔ جدید، schema map و event را با قبلی مقایسه کنید. استفادهٔ دوباره از map قدیمی با value ناسازگار می‌تواند مصرف‌کننده را خراب کند. تعویض برنامه نیز همهٔ تنظیمات و وضعیت بیرونی را اتمیک نمی‌کند؛ شیوهٔ update به نوع attachment و API انتخاب‌شده وابسته است.

مسیر rollback باید مشخص، قابل‌آزمایش و محدود به objectهای متعلق به همین ابزار باشد. پاک‌کردن کورکورانهٔ pinها یا همهٔ برنامه‌های یک interface ممکن است ابزار دیگری را از کار بیندازد.

## ۶. payload را حداقل کنید

آرگومان processها، مسیرها، IPها و payload شبکه ممکن است اطلاعات حساس داشته باشند. «ابزار observability» بودن مجوز جمع‌آوری همهٔ داده‌ها نیست. دسترسی، retention، حذف داده و مقصد انتقال را مشخص کنید.

اغلب count، histogram یا metadata محدود برای پاسخ به پرسش کافی است. map dump یا log debug را نیز در دستهٔ دادهٔ حساس بررسی کنید؛ حذف payload از خروجی اصلی به‌تنهایی کافی نیست.

## مسیر پیشنهادی یادگیری

از [تاریخچهٔ BPF]({% post_url 2026-10-11-bpf-history %}) به [مدل اجرا]({% post_url 2026-10-11-ebpf-program-lifecycle %}) برسید؛ سپس [mapها]({% post_url 2026-10-11-bpf-maps-and-concurrency %}) و [انتقال رویداد]({% post_url 2026-10-11-ringbuf-perf-events %}) را بخوانید. برای کاربردها، [tracing]({% post_url 2026-10-11-ebpf-tracing-observability %})، [شبکه]({% post_url 2026-10-11-xdp-tc-networking %}) و [امنیت]({% post_url 2026-10-11-ebpf-security-lsm %}) را دنبال کنید و در نهایت [BTF و CO-RE]({% post_url 2026-10-11-btf-core-libbpf %}) را وارد جریان build خود کنید.

در [BPFLab](https://bpflab.ir/exercises/) می‌توانید بخشی از این مفاهیم را روی محیط ایزوله تمرین کنید؛ مجوزها و امکانات محیط آموزشی را با میزبان عملیاتی یکسان فرض نکنید.

## منابع

- [مستندات رسمی bpftool feature](https://github.com/libbpf/bpftool/blob/main/docs/bpftool-feature.rst)
- [مستندات رسمی bpftool prog](https://github.com/libbpf/bpftool/blob/main/docs/bpftool-prog.rst)
- [مستندات رسمی bpftool map](https://github.com/libbpf/bpftool/blob/main/docs/bpftool-map.rst)
- [مستندات رسمی bpftool link](https://github.com/libbpf/bpftool/blob/main/docs/bpftool-link.rst)
- [مدل objectها و عملیات syscall در bpf(2)](https://man7.org/linux/man-pages/man2/bpf.2.html)
