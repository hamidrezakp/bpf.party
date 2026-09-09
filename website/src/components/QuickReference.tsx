import type { FuncDoc as FuncDocType } from "../types/function-docs";
import FuncDoc from "./FuncDoc";
import styles from "./QuickReference.module.css";

interface QuickReferenceProps {
  stringMatching?: boolean;
  stringSearch?: boolean;
  mapUsage?: boolean;
  userSpaceReading?: boolean;
  kernelSpaceReading?: boolean;
  kprobeArgs?: boolean;
  pid?: boolean;
  comm?: boolean;
}

const stringMatchingFuncs: FuncDocType[] = [
  {
    function_name: "bpf_strncmp",
    description: "مقایسهٔ دو رشته برای برابری",
    args: [
      {
        type: "char*",
        name: "buf",
        description: "بافر پویا برای مقایسه",
      },
      {
        type: "u32",
        name: "buf_sz",
        description: "طول بافر پویا",
      },
      {
        type: "const char*",
        name: "buf2",
        description: "رشتهٔ ثابت برای مقایسه",
      },
    ],
    returns: {
      type: "int",
      description: "۰ اگر رشته‌ها برابر باشند، غیرصفر در غیر این صورت",
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_strncmp/",
  },
];

const stringSearchFuncs: FuncDocType[] = [
  {
    function_name: "bpf_strstr",
    description: "یافتن زیررشته در رشته",
    args: [
      {
        type: "const char*",
        name: "haystack",
        description: "رشته‌ای که در آن جستجو می‌شود",
      },
      {
        type: "const char*",
        name: "needle",
        description: "زیررشتهٔ مورد جستجو",
      },
    ],
    returns: {
      type: "long",
      description: "اندیس needle در haystack، یا مقدار منفی در صورت خطا",
    },
    docsUrl: "https://docs.ebpf.io/linux/kfuncs/bpf_strstr/",
  },
  {
    function_name: "bpf_strchr",
    description: "یافتن یک کاراکتر در رشته",
    args: [
      {
        type: "const char*",
        name: "str",
        description: "رشته‌ای که در آن جستجو می‌شود",
      },
      {
        type: "char",
        name: "c",
        description: "کاراکتر مورد جستجو",
      },
    ],
    returns: {
      type: "long",
      description: "اندیس کاراکتر در رشته، یا مقدار منفی در صورت خطا",
    },
    docsUrl: "https://docs.ebpf.io/linux/kfuncs/bpf_strchr/",
  },
];

const mapUsageFuncs: FuncDocType[] = [
  {
    function_name: "bpf_map_update_elem",
    description: "درج یا به‌روزرسانی یک ورودی map",
    args: [
      {
        type: "void*",
        name: "map",
        description: "اشاره‌گر به map",
      },
      {
        type: "const void*",
        name: "key",
        description: "اشاره‌گر به کلید",
      },
      {
        type: "const void*",
        name: "value",
        description: "اشاره‌گر به مقدار",
      },
      {
        type: "u64",
        name: "flags",
        description:
          "BPF_ANY (ایجاد یا به‌روزرسانی)، BPF_NOEXIST (فقط ایجاد)، یا BPF_EXIST (فقط به‌روزرسانی)",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "0",
        error: "کد خطای منفی",
      },
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_map_update_elem/",
  },
  {
    function_name: "bpf_map_lookup_elem",
    description: "دریافت مقدار از map با کلید",
    args: [
      {
        type: "void*",
        name: "map",
        description: "اشاره‌گر به map",
      },
      {
        type: "const void*",
        name: "key",
        description: "اشاره‌گر به کلید",
      },
    ],
    returns: {
      type: "void*",
      description: "اشاره‌گر به مقدار در صورت یافتن، در غیر این صورت NULL",
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_map_lookup_elem/",
  },
  {
    function_name: "bpf_map_delete_elem",
    description: "حذف یک ورودی از map",
    args: [
      {
        type: "void*",
        name: "map",
        description: "اشاره‌گر به map",
      },
      {
        type: "const void*",
        name: "key",
        description: "اشاره‌گر به کلید برای حذف",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "0",
        error: "کد خطای منفی اگر کلید یافت نشود",
      },
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_map_delete_elem/",
  },
];

const kprobeArgsFuncs: FuncDocType[] = [
  {
    function_name: "PT_REGS_PARM{1-8}",
    description: "استخراج پارامتر Nام از زمینهٔ kprobe",
    args: [
      {
        type: "struct pt_regs*",
        name: "ctx",
        description: "زمینهٔ kprobe شامل رجیسترهای CPU",
      },
    ],
    returns: {
      type: "unsigned long",
      description: "مقدار پارامتر Nام تابع",
    },
    docsUrl: "https://docs.ebpf.io/ebpf-library/libbpf/ebpf/PT_REGS_PARM/",
  },
];

const kernelSpaceReadingFuncs: FuncDocType[] = [
  {
    function_name: "bpf_probe_read_kernel",
    description: "خواندن بایت‌ها از فضای kernel به بافر kernel",
    args: [
      {
        type: "void*",
        name: "dst",
        description: "بافر kernel برای خواندن",
      },
      {
        type: "u32",
        name: "size",
        description: "تعداد بایت برای خواندن",
      },
      {
        type: "const void*",
        name: "src",
        description: "اشاره‌گر فضای kernel",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "0",
        error: "کد خطای منفی",
      },
    },
    docsUrl:
      "https://docs.ebpf.io/linux/helper-function/bpf_probe_read_kernel/",
  },
  {
    function_name: "bpf_probe_read_kernel_str",
    description: "خواندن رشته از فضای kernel به بافر kernel",
    args: [
      {
        type: "void*",
        name: "dst",
        description: "بافر kernel برای خواندن",
      },
      {
        type: "u32",
        name: "size",
        description: "حداکثر بایت برای خواندن",
      },
      {
        type: "const void*",
        name: "src",
        description: "اشاره‌گر رشته در فضای kernel",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "تعداد بایت خوانده‌شده (شامل null terminator)",
        error: "کد خطای منفی",
      },
    },
    docsUrl:
      "https://docs.ebpf.io/linux/helper-function/bpf_probe_read_kernel_str/",
  },
];

const userSpaceReadingFuncs: FuncDocType[] = [
  {
    function_name: "bpf_probe_read_user_str",
    description: "خواندن رشته از فضای user به بافر kernel",
    args: [
      {
        type: "void*",
        name: "dst",
        description: "بافر kernel برای خواندن",
      },
      {
        type: "u32",
        name: "size",
        description: "حداکثر بایت برای خواندن",
      },
      {
        type: "const void*",
        name: "src",
        description: "اشاره‌گر رشته در فضای user",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "تعداد بایت خوانده‌شده (شامل null terminator)",
        error: "کد خطای منفی",
      },
    },
    docsUrl:
      "https://docs.ebpf.io/linux/helper-function/bpf_probe_read_user_str/",
  },
  {
    function_name: "bpf_probe_read_user",
    description: "خواندن بایت‌ها از فضای user به بافر kernel",
    args: [
      {
        type: "void*",
        name: "dst",
        description: "بافر kernel برای خواندن",
      },
      {
        type: "u32",
        name: "size",
        description: "تعداد بایت برای خواندن",
      },
      {
        type: "const void*",
        name: "src",
        description: "اشاره‌گر فضای user",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "0",
        error: "کد خطای منفی",
      },
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_probe_read_user/",
  },
];

const getPID: FuncDocType[] = [
  {
    function_name: "bpf_get_current_pid_tgid",
    description: "دریافت شناسهٔ پردازه و thread فعلی",
    args: [],
    returns: {
      type: "u64",
      description: "۳۲ بیت بالایی PID و ۳۲ بیت پایینی TID است.",
    },
    docsUrl:
      "https://docs.ebpf.io/linux/helper-function/bpf_get_current_pid_tgid/",
  },
];
const getCOMM: FuncDocType[] = [
  {
    function_name: "bpf_get_current_comm",
    description: "دریافت نام پردازهٔ فعلی",
    args: [
      {
        type: "char*",
        name: "buf",
        description: "بافر برای نوشتن نام پردازه",
      },
      {
        type: "u32",
        name: "size",
        description: "اندازهٔ بافر",
      },
    ],
    returns: {
      type: "int",
      description: {
        success: "0",
        error: "کد خطای منفی",
      },
    },
    docsUrl: "https://docs.ebpf.io/linux/helper-function/bpf_get_current_comm/",
  },
];

export default function QuickReference({
  stringMatching = false,
  stringSearch = false,
  mapUsage = false,
  userSpaceReading = false,
  kernelSpaceReading = false,
  kprobeArgs = false,
  pid = false,
  comm = false,
}: QuickReferenceProps) {
  const funcs = [
    pid ? getPID : [],
    comm ? getCOMM : [],
    stringMatching ? stringMatchingFuncs : [],
    stringSearch ? stringSearchFuncs : [],
    mapUsage ? mapUsageFuncs : [],
    kprobeArgs ? kprobeArgsFuncs : [],
    userSpaceReading ? userSpaceReadingFuncs : [],
    kernelSpaceReading ? kernelSpaceReadingFuncs : [],
  ].flat();
  return (
    <div className={styles.reference}>
      <b className={styles.title}>مرجع سریع</b>
      {funcs.map((func, index) => (
        <FuncDoc key={index} doc={func} />
      ))}
    </div>
  );
}
