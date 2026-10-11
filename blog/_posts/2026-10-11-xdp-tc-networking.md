---
title: "eBPF در مسیر شبکه: تفاوت XDP و tc و انتخاب hook مناسب"
summary: "جایگاه XDP و tc در مسیر بسته، حالت‌های اجرا، معنای actionها و نمونهٔ بررسی محدودهٔ هدر؛ چرا محل اتصال بخشی از طراحی است؟"
date: 2026-10-11 15:00:00 +0330
author: "تیم BPFLab <help@bpflab.ir>"
image: /assets/images/posts/bpf-networking.svg
category: شبکه
tags: [eBPF, XDP, tc, networking]
---

در شبکه، یک تصمیم یکسان در دو نقطهٔ متفاوت از مسیر بسته می‌تواند هزینه و اطلاعات در دسترس متفاوتی داشته باشد. حذف زودهنگام ترافیک، اعمال سیاست نزدیک stack، تغییر مسیر و مشاهدهٔ metadata الزاماً با یک hook حل نمی‌شوند.

**XDP** و **tc BPF** دو انتخاب مهم‌اند، اما جای هم را به‌صورت کامل نمی‌گیرند.

## XDP کجا اجرا می‌شود؟

در حالت native یا driver، برنامهٔ XDP روی مسیر دریافت driver و پیش از ساخت `skb` معمول stack اجرا می‌شود. همین جایگاه برای تصمیم‌های زودهنگام، مانند filtering یا redirect، جذاب است.

سه حالت را از هم جدا کنید:

- **Native/driver:** نیازمند پشتیبانی driver و قابلیت مورد استفاده؛ مسیر اولیهٔ دریافت.
- **Generic/SKB:** مسیر سازگاری در stack که پس از وجود `skb` اجرا می‌شود؛ ویژگی هزینهٔ native را نباید به آن نسبت داد.
- **Offload:** اجرای پشتیبانی‌شده روی سخت‌افزار؛ به NIC، driver و محدودیت مجموعه‌قابلیت وابسته است.

بنابراین موفق شدن attach در یک حالت ثابت نمی‌کند که برنامه با همان هزینه یا همان امکانات در حالت دیگر اجرا می‌شود. پشتیبانی multi-buffer، redirect و helperها را روی رابط مقصد بررسی کنید.

## tc چه مزیتی دارد؟

در hookهای رایج ingress و egress مربوط به tc، برنامه context از نوع `__sk_buff` دارد و می‌تواند از metadata و امکانات مسیر `skb` استفاده کند. این نقطه برای classification، policy و پردازش‌هایی که به چنین اطلاعاتی نیاز دارند مناسب است؛ XDP معمول دریافت اولیه، hook عمومی خروج بسته نیست.

در tc با حالت direct-action، مقدارهایی مانند `TC_ACT_OK` و `TC_ACT_SHOT` قرارداد تصمیم‌اند. در XDP از actionهای `XDP_*` استفاده می‌شود. مقدار عددی بازگشتی را بین این دو نوع برنامه کپی نکنید؛ معنای آن به نوع برنامه و attachment وابسته است.

## actionهای XDP دقیقاً چه می‌گویند؟

| action | معنا |
|---|---|
| `XDP_PASS` | ادامه دادن بسته به مسیر عادی stack |
| `XDP_DROP` | دور ریختن بسته در این مسیر |
| `XDP_TX` | ارسال بسته از همان رابط دریافت، در مسیر پشتیبان |
| `XDP_REDIRECT` | اجرای redirect آماده‌شده، معمولاً با helper مناسب |
| `XDP_ABORTED` | وضعیت خطای برنامه؛ با drop سیاستی یکسان نیست |

بازگرداندن `XDP_REDIRECT` به‌تنهایی مقصد نمی‌سازد. لازم است helper و map یا مقصد مربوط به redirect با قرارداد درست استفاده شوند.

## نمونهٔ غیرمسدودکننده: فقط بررسی هدر Ethernet

این object حداقلی برای آموزش bounds checking نوشته شده است؛ **همهٔ بسته‌ها را pass می‌کند** و سیاست فیلتر عملیاتی ندارد:

```c
#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <bpf/bpf_helpers.h>

SEC("xdp")
int inspect_ethernet(struct xdp_md *ctx)
{
    void *data = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;
    struct ethhdr *eth = data;

    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    /* Header reads are allowed after proving this range exists. */
    return XDP_PASS;
}

char LICENSE[] SEC("license") = "GPL";
```

به Clang با هدف BPF و هدرهای Linux/libbpf نیاز دارید. چون مثال عمداً هدر را مصرف نمی‌کند، optimizer ممکن است بررسی را حذف کند؛ برای برنامهٔ واقعی باید استفاده از فیلدها بعد از بررسی باقی بماند. این قطعه آموزش ساختار امن دسترسی است، نه benchmark یا ابزار شمارش بسته.

برای هر لایهٔ بعدی، باید اندازهٔ واقعی آن لایه را بررسی کنید. Ethernet ساده، VLAN، IPv4 با header length متغیر، fragmentها و extension headerهای IPv6 یک layout ثابت ندارند. `data_end` نیز محدودهٔ مستقیم در دسترس را مشخص می‌کند؛ وجود یک فیلد در struct C جای این اثبات را نمی‌گیرد.

## از use case به طراحی

**کاهش ترافیک مزاحم:** filtering زودهنگام در XDP می‌تواند هزینهٔ stack را کم کند، اما counterهای drop و راه بازگشت سیاست لازم‌اند. حذف بسته را روی رابط مدیریت خود بدون محیط آزمایش انجام ندهید.

**سیاست و routing:** tc یا hookهای cgroup/socket بسته به نیاز ممکن است context مناسب‌تری بدهند. اگر سؤال «کدام process این اتصال را باز کرد؟» باشد، header بسته همیشه پاسخ را ندارد.

**Load balancing:** mapها، redirect و تغییر header تنها اجزای یک طراحی کامل‌اند؛ checksum، MTU، fragmentation، health checking و state ارتباط هم باید حل شوند.

eBPF محدودیت لینک شبکه را حذف نمی‌کند. وقتی uplink پیش از رسیدن بسته به میزبان اشباع شده، filtering روی همان میزبان جای mitigation بالادست را نمی‌گیرد.

برای بررسی ظرفیت و هزینهٔ برنامه، [چک‌لیست عملیاتی]({% post_url 2026-10-11-ebpf-production-checklist %}) را دنبال کنید.

## منابع

- [راهنمای رسمی XDP از پروژهٔ xdp-project](https://github.com/xdp-project/xdp-tutorial)
- [مستندات هسته: BPF و socket filtering، شامل مسیرهای شبکه](https://docs.kernel.org/networking/filter.html)
- [تعریف رسمی xdp_md، __sk_buff و actionهای XDP](https://github.com/torvalds/linux/blob/master/include/uapi/linux/bpf.h)
- [تعریف actionهای tc در هدر Linux](https://github.com/torvalds/linux/blob/master/include/uapi/linux/pkt_cls.h)
