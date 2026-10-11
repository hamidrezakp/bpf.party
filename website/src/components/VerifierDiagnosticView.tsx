import { useState } from "react";
import type { VerifierDiagnostic } from "../types/sse-events";
import styles from "./EventViewer.module.css";

export default function VerifierDiagnosticView({
  data,
}: {
  data: VerifierDiagnostic;
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className={styles.diagnostic}>
      <div className={styles.diagnosticTabs}>
        <button
          className={!showRaw ? styles.tabActive : styles.tab}
          onClick={() => setShowRaw(false)}
          aria-pressed={!showRaw}
        >
          گزارش خطا
        </button>
        <button
          className={showRaw ? styles.tabActive : styles.tab}
          onClick={() => setShowRaw(true)}
          aria-pressed={showRaw}
        >
          خروجی خام verifier
        </button>
      </div>
      <pre dir="ltr" lang="en" className={styles.diagnosticBody}>
        {showRaw ? data.raw : data.rendered}
      </pre>
    </div>
  );
}
