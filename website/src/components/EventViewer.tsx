import type { SSEEvent } from "../types/sse-events";
import type { TypeInfo } from "../types/typeinfo";
import ParsedEventViewer from "./ParsedEventViewer";
import VerifierDiagnosticView from "./VerifierDiagnosticView";
import styles from "./EventViewer.module.css";
import { X } from "lucide-react";

interface EventViewerProps {
  events: SSEEvent[];
  isRunning: boolean;
  onClear: () => void;
  typeRegistry: { [name: string]: TypeInfo };
  droppedEvents?: number;
}

export default function EventViewer({
  events,
  isRunning,
  onClear,
  typeRegistry,
  droppedEvents = 0,
}: EventViewerProps) {
  const getEventStyle = (
    event: SSEEvent,
  ): "error" | "success" | "warning" | "normal" => {
    if (event.type === "compileError") return "error";
    if (event.type === "requestError") return "error";
    if (event.type === "wrongAnswer") return "error";
    if (event.type === "correctAnswer") return "success";
    if (event.type === "multipleAnswers") return "warning";
    if (event.type === "noAnswer") return "warning";
    if (event.type === "guestMessage") {
      if (event.data.type === "debugMapNotFound") return "error";
      if (event.data.type === "noProgramsFound") return "error";
      if (event.data.type === "cantAttachProgram") return "error";
      if (event.data.type === "verifierFail") return "error";
      if (event.data.type === "crashed") return "error";
    }
    return "normal";
  };

  const formatEvent = (event: SSEEvent): string => {
    if (event.type === "compileError") {
      return event.data;
    }
    if (event.type === "requestError") {
      return `خطای درخواست: \u2066${event.data}\u2069`;
    }
    if (event.type === "correctAnswer") {
      return "پاسخ درست است!";
    }
    if (event.type === "wrongAnswer") {
      return "پاسخ نادرست است";
    }
    if (event.type === "multipleAnswers") {
      return "بیش از یک پاسخ ارسال شده است";
    }
    if (event.type === "noAnswer") {
      return "پاسخی ارسال نکردید. از SUBMIT_STR یا SUBMIT_NUM استفاده کنید.";
    }
    if (event.type === "guestMessage") {
      if (event.data.type === "debugMapNotFound") {
        return "خطا: هیچ perf map در برنامه پیدا نشد";
      }
      if (event.data.type === "noProgramsFound") {
        return "خطا: هیچ برنامهٔ eBPF پیدا نشد. SEC() را بررسی کنید.";
      }
      if (event.data.type === "cantAttachProgram") {
        const { section, kind } = event.data.data;
        if (kind === "noSuchHook") {
          return `اتصال به \u2066${section}\u2069 ناموفق بود. نام hook را بررسی کنید.`;
        }
        if (kind === "denied") {
          return `هسته برنامه را برای \u2066${section}\u2069 رد کرد. معمولاً دلیل آن خواندن خارج از محدودهٔ ctx است.`;
        }
        return `اتصال به \u2066${section}\u2069 ناموفق بود.`;
      }
      if (event.data.type === "verifierFail") {
        return event.data.data;
      }
      if (event.data.type === "crashed") return "ماشین مجازی متوقف شد";
      if (event.data.type === "foundMap")
        return `map پیدا شد: \u2066${event.data.data.name}\u2069`;
      return "data" in event.data
        ? `${event.data.type}: ${JSON.stringify(event.data.data)}`
        : event.data.type;
    }
    return event.type;
  };

  // When a structured diagnostic is present, the raw verifierFail row is
  // redundant: the diagnostic component shows the raw log under its own tab.
  const hasDiagnostic = events.some((e) => e.type === "verifierDiagnostic");

  // If anything errored, the program never ran, so a "you didn't submit an
  // answer" warning is noise — there was no chance to submit one.
  const hasError = events.some((e) => getEventStyle(e) === "error");

  return (
    <div className={styles.eventViewer}>
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3>رویدادهای اجرا</h3>
          {isRunning && <span className={styles.loading}>در حال دریافت…</span>}
        </div>
        <button
          className={styles.closeButton}
          onClick={onClear}
          aria-label="پاک کردن رویدادها"
          title="پاک کردن رویدادها"
        >
          <X aria-hidden="true"></X>
        </button>
      </div>
      <div className={styles.events} aria-live="polite">
        {droppedEvents > 0 && (
          <p className={styles.warningEvent}>
            تعداد {droppedEvents.toLocaleString("fa-IR")} رویداد پرحجم نمایش
            داده نشد.
          </p>
        )}
        {events
          .filter(
            (event) =>
              ["compiling", "booting", "stack"].indexOf(event.type) < 0,
          )
          .filter(
            (event) =>
              event.type !== "guestMessage" ||
              ["booted", "foundProgram", "finished"].indexOf(event.data.type) ==
                -1,
          )
          .filter(
            (event) =>
              !hasDiagnostic ||
              event.type !== "guestMessage" ||
              event.data.type !== "verifierFail",
          )
          .filter((event) => !(hasError && event.type === "noAnswer"))
          .map((event, i) => {
            if (event.type === "verifierDiagnostic") {
              return <VerifierDiagnosticView key={i} data={event.data} />;
            }
            if (event.type === "guestMessage" && event.data.type === "event") {
              return (
                <ParsedEventViewer
                  key={i}
                  data={event.data.data}
                  typeRegistry={typeRegistry}
                />
              );
            }

            const eventStyle = getEventStyle(event);
            const className =
              eventStyle === "error"
                ? styles.errorEvent
                : eventStyle === "success"
                  ? styles.successEvent
                  : eventStyle === "warning"
                    ? styles.warningEvent
                    : styles.event;

            return (
              <p
                key={i}
                dir={
                  event.type === "compileError" ||
                  (event.type === "guestMessage" &&
                    event.data.type === "verifierFail")
                    ? "ltr"
                    : "rtl"
                }
                className={className}
              >
                {formatEvent(event)}
              </p>
            );
          })}
      </div>
    </div>
  );
}
