---
title: "از هسته تا فضای کاربر: ring buffer یا perf buffer؟"
summary: "طراحی انتقال رویداد در eBPF، ترتیب رزروها، فشار مصرف‌کننده و شمارش رویدادهای ازدست‌رفته؛ چرا بافر بزرگ به‌تنهایی کافی نیست؟"
date: 2026-10-11 13:00:00 +0330
author: "تیم BPFLab <help@bpflab.ir>"
image: /assets/images/posts/bpf-maps.svg
category: انتقال داده
tags: [eBPF, ringbuf, perf, observability]
---

وقتی یک برنامهٔ BPF رویدادی را می‌بیند، دو انتخاب اساسی دارد: همان‌جا آن را به metric تجمیع کند یا جزئیات آن را به فضای کاربر بفرستد. انتخاب دوم به یک کانال محدود نیاز دارد؛ هسته نباید منتظر مصرف‌کنندهٔ کند بماند.

برای debugging، `bpf_printk` مفید است، اما برای جریان پایدار رویداد و schema مشخص، باید سراغ رابطی مانند **perf event buffer** یا **BPF ring buffer** رفت.

## تفاوت اصلی: topology بافر

در الگوی رایج `BPF_MAP_TYPE_PERF_EVENT_ARRAY`، هر CPU بافر perf خود را دارد و برنامه با `bpf_perf_event_output` رویداد را به آن می‌فرستد. مصرف‌کننده باید دادهٔ CPUها را دریافت و، اگر لازم است، با timestamp و قواعد کاربردی ادغام کند.

`BPF_MAP_TYPE_RINGBUF` یک ring buffer با چند تولیدکننده و یک مصرف‌کننده فراهم می‌کند که می‌تواند میان CPUها مشترک باشد. دو انگیزهٔ طراحی آن، استفادهٔ بهتر از حافظهٔ مشترک و نگهداری ترتیب رزرو رویدادها در همان ring هستند.

| جنبه | perf buffer | BPF ring buffer |
|---|---|---|
| الگوی رایج حافظه | بافر جدا برای هر CPU | ring مشترک یا طراحی چند ring |
| انتقال رکورد | خروجی helper به بافر perf | output یا reserve/submit |
| ترتیب چند CPU | نیازمند ادغام در مصرف‌کننده | ترتیب reservation در یک ring |
| فشار بیش از ظرفیت | ممکن است داده از دست برود | رزرو یا output می‌تواند شکست بخورد |

این مقایسه به معنای «ringbuf همیشه سریع‌تر است» نیست. یک ring مشترک می‌تواند محل رقابت تولیدکنندگان باشد؛ چند ring با sharding ممکن است مناسب‌تر باشند، اما آن‌وقت ترتیب سراسری را از دست می‌دهید.

## reserve و submit چه قراردادی دارند؟

در این **قطعهٔ آموزشی**، `events` یک ringbuf map و `struct event` نوع ثابت رکورد است:

```c
struct event {
    __u64 timestamp_ns;
    __u64 pid_tgid;
};

static __always_inline void emit_event(void)
{
    struct event *event;

    event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
    if (!event) {
        /* Increment a separate per-CPU reservation-failure counter. */
        return;
    }

    event->timestamp_ns = bpf_ktime_get_ns();
    event->pid_tgid = bpf_get_current_pid_tgid();
    bpf_ringbuf_submit(event, 0);
}
```

در `bpf_ringbuf_reserve` معمولی، اندازه باید برای وریفایر ثابت و شناخته‌شده باشد. بعد از رزرو موفق، تمام مسیرهای خروج باید رکورد را submit یا discard کنند. نباید پس از submit دوباره از اشاره‌گر استفاده کرد.

مزیت این الگو، نوشتن مستقیم در حافظهٔ رزروشده به‌جای ساخت رکورد روی stack و سپس کپی آن است. `bpf_ringbuf_output` در مقابل، دادهٔ آماده‌شده را کپی می‌کند و برای برخی اندازه‌های پویا مناسب است. انتخاب به حجم رکورد و قرارداد helper در هستهٔ مقصد بستگی دارد.

## ترتیب رزرو با ترتیب timestamp فرق دارد

رکوردها در یک ring به ترتیب **رزرو** به مصرف‌کننده می‌رسند. اگر تولیدکنندهٔ اول دیر submit کند، رکوردی که بعداً رزرو و زودتر آماده شده نیز ممکن است منتظر آن بماند.

پس ring buffer یک ساعت جهانی برای همهٔ رخدادها نمی‌سازد. اگر timestamp قبل یا بعد از reservation ثبت شود، preemption و فاصلهٔ اجرای CPUها می‌توانند ترتیب timestamp و ترتیب دریافت را متفاوت کنند. در سامانهٔ توزیع‌شده یا با چند ring، نیاز به قواعد correlation همچنان وجود دارد.

## رویداد گم‌شده را قابل‌مشاهده کنید

شکست reservation فقط به معنای «بافر پر است» نیست؛ برای مثال در برخی contextهای NMI، گرفتن قفل رزرو نیز می‌تواند شکست بخورد. بهتر است metric را «شکست رزرو» بنامید و بدون شواهد، علت قطعی به آن نسبت ندهید.

در طراحی واقعی حداقل این شمارنده‌ها مفیدند:

- رویدادهای دیده‌شده در hook؛
- رویدادهای حذف‌شده به‌دلیل filtering یا sampling؛
- شکست output یا reservation؛
- رکوردهای نامعتبر در مصرف‌کننده؛
- تأخیر و backlog مصرف‌کننده.

اگر مصرف‌کننده کند باشد، بزرگ‌کردن ring فقط زمان رسیدن به اشباع را تغییر می‌دهد. تجمیع metric در map، نمونه‌برداری و کوچک‌کردن payload راه‌حل‌های بنیادی‌تری هستند. هیچ‌گاه بدون اندازه‌گیری، ادعای انتقال «بدون افت» نکنید.

## schema رویداد، قرارداد دو برنامه است

producer و consumer باید دربارهٔ اندازه، ترتیب فیلدها، padding و نسخهٔ رکورد توافق داشته باشند. مقداردهی نکردن padding، کپی structهای داخلی هسته یا ارسال payload حساس می‌تواند مشکل‌ساز شود. schema ثابت با نوع‌های صریح، شناسهٔ نسخه و بررسی طول در مصرف‌کننده، قابل‌نگهداری‌تر است.

برای پرسش‌هایی که فقط count یا histogram می‌خواهند، [mapهای per-CPU]({% post_url 2026-10-11-bpf-maps-and-concurrency %}) ممکن است از ارسال تک‌تک رویدادها بهتر باشند.

## منابع

- [مستندات هسته: طراحی و قرارداد BPF ring buffer](https://docs.kernel.org/bpf/ringbuf.html)
- [تعریف helperهای ringbuf و perf event در هدر رسمی Linux](https://github.com/torvalds/linux/blob/master/include/uapi/linux/bpf.h)
- [رابط مصرف‌کنندهٔ ring buffer و perf buffer در libbpf](https://libbpf.readthedocs.io/en/latest/api.html)
