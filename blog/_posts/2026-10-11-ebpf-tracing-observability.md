---
title: "ردیابی با eBPF: از انتخاب hook تا اندازه‌گیری درست latency"
summary: "tracepoint، kprobe، fentry و uprobe چه تفاوتی دارند؟ طراحی شمارنده، histogram و هم‌بستگی entry/exit برای مشاهده‌پذیری قابل‌اعتماد."
date: 2026-10-11 14:00:00 +0330
author: "تیم BPFLab <help@bpflab.ir>"
image: /assets/images/posts/verifier-diagnostics.svg
category: ردیابی و مشاهده‌پذیری
tags: [eBPF, tracing, bpftrace, latency]
---

«برنامه کند است» یک مسئلهٔ قابل‌اندازه‌گیری نیست تا زمانی که مرز عملیات و تعریف کندی روشن شود. آیا زمان اجرای syscall را می‌خواهیم، مدت انتظار برای دیسک، زمان off-CPU یا تأخیر پاسخ یک درخواست HTTP؟ eBPF می‌تواند به این پرسش‌ها کمک کند، اما hook درست و قرارداد جمع‌آوری داده مهم‌تر از تعداد رویدادها هستند.

## hook را از روی معنای رویداد انتخاب کنید

| ابزار اتصال | چه چیزی را مشاهده می‌کند؟ | هزینهٔ سازگاری |
|---|---|---|
| tracepoint | رویداد از پیش تعریف‌شده با فیلدهای مشخص | اغلب از تابع داخلی پایدارتر، ولی نیازمند بررسی وجود و schema |
| kprobe/kretprobe | نقطه‌ای در تابع هسته یا بازگشت آن | وابسته به symbol، نسخه و امکان probe کردن |
| fentry/fexit | ورود/خروج تابع قابل‌اتصال از مسیر trampoline | وابسته به BTF، پشتیبانی هسته/معماری و هدف اتصال |
| uprobe/uretprobe | کد فضای کاربر در executable یا کتابخانه | وابسته به binary، offset، ABI و محل اجرای واقعی |
| USDT | probe از پیش تعریف‌شده در برنامهٔ فضای کاربر | وابسته به وجود probe و ابزار مصرف‌کننده |

fentry در بسیاری از سناریوها overhead مناسبی دارد، اما «همیشه بدون هزینه» نیست. kprobe نیز راهی برای دستیابی به هر تابع نیست؛ توابع inlineشده، نقاط ممنوع و تغییر ABI می‌توانند مانع باشند.

برای uprobe، نام فایل کتابخانه در میزبان الزاماً همان فایل دیده‌شده در container نیست. JITها و زبان‌های دارای runtime نیز می‌توانند تشخیص تابع و ارتباط آن با درخواست کاربردی را پیچیده کنند.

## یک پرسش محدود: چند read اجرا می‌شود؟

در سیستمی با `bpftrace` نصب‌شده و tracepointهای مربوط، ابتدا وجود probe را بررسی کنید:

```bash
sudo bpftrace -l 'tracepoint:syscalls:sys_enter_read'
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_read { @reads[comm] = count(); }'
```

فرمان دوم تا توقف ابزار، شمارش را بر اساس نام process تجمیع می‌کند. این ابزار به دسترسی مناسب و پشتیبانی هسته نیاز دارد و در میزبان واقعی رویدادهای دیگر processها را نیز می‌بیند؛ آن را روی محیط تحت اختیار خود اجرا کنید.

`comm` شناسهٔ یکتا نیست و نام محدودشدهٔ task است. این مثال تعداد ورود به syscall را می‌شمارد؛ نه حجم موفق خواندن، تعداد درخواست‌های HTTP یا latency. نتیجهٔ syscall را فقط در مسیر exit می‌توان برای موفقیت و اندازهٔ واقعی بررسی کرد. همین تفکیک ساده جلوی بسیاری از dashboardهای گمراه‌کننده را می‌گیرد.

## latency به دو رویداد و یک هویت نیاز دارد

برای اندازه‌گیری مدت یک عملیات می‌توان timestamp ورود را در map نگه داشت و در خروج تفاضل گرفت:

```text
entry: start[operation_identity] = monotonic_timestamp
exit:
    if start exists:
        duration = now - start
        add duration to histogram
        delete start
    else:
        increment unmatched_exit
```

این شبه‌کد عمداً کلید را فقط `PID` نام‌گذاری نمی‌کند. در syscall معمولی، شناسهٔ thread می‌تواند مناسب باشد؛ برای تابع recursive، callbackهای تو‌در‌تو یا درخواست asynchronous ممکن است شناسهٔ عملیات و stack یا شمارندهٔ عمق لازم باشد. شناسهٔ process به‌تنهایی برای چند thread هم‌زمان کافی نیست.

اگر عملیات بین CPUها جابه‌جا شود، mapِ per-CPU برای نگهداری timestamp entry ممکن است در exit مقدار را پیدا نکند. `bpf_ktime_get_ns()` یک ساعت monotonic برای این محاسبات فراهم می‌کند، نه زمان تقویمی Unix؛ آن را مستقیم به تاریخ دیواری تبدیل نکنید.

برای اندازه‌گیری syscall، مدت entry تا exit می‌تواند زمان انتظار و scheduling را هم شامل شود. نام metric باید همین معنا را بیان کند، نه «زمان مصرف CPU».

## histogram قبل از جریان کامل رویداد

وقتی سؤال دربارهٔ توزیع latency است، bucketهای histogram روی map اغلب بهتر از ارسال هر رخدادند. bucketهای لگاریتمی دامنهٔ بزرگی را با حافظهٔ محدود نشان می‌دهند، ولی دقت percentile استخراج‌شده به مرز bucketها وابسته است.

میانگین به‌تنهایی tail latency را پنهان می‌کند. در مقابل، گفتن «p99 دقیق» از histogram کم‌دقت نیز درست نیست. شمار نمونه، بازهٔ زمانی، bucketها، رویدادهای unmatched و افت خروجی باید کنار metric مشخص باشند.

## overhead را اندازه بگیرید

هزینهٔ برنامهٔ کوچک روی hook کم‌تکرار با خواندن stack و payload روی مسیر پرتکرار یکسان نیست. پیش از استقرار، throughput، CPU، latency و حجم داده را با baseline مقایسه کنید. filtering زودهنگام، sampling و تجمیع در هسته می‌توانند هزینه را کم کنند، اما sampling باید در تفسیر نتایج لحاظ شود.

اگر واقعاً به جزئیات هر رویداد نیاز دارید، [قرارداد ring buffer]({% post_url 2026-10-11-ringbuf-perf-events %}) و شمارش افت داده را هم طراحی کنید.

## منابع

- [مستندات tracepointهای هسته](https://docs.kernel.org/trace/tracepoints.html)
- [مستندات Kprobes و محدودیت‌های آن](https://docs.kernel.org/trace/kprobes.html)
- [مستندات Uprobe tracer](https://docs.kernel.org/trace/uprobetracer.html)
- [مستندات رسمی bpftrace و زبان آن](https://bpftrace.org/docs/release_024/language)
- [انواع section و attachment در libbpf](https://docs.kernel.org/bpf/libbpf/program_types.html)
