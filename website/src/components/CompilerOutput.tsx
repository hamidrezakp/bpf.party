import clsx from "clsx";
import styles from "./App.module.css";

interface CompilerOutputProps {
  output: string;
  outputClass: "warning" | "error";
}

export default function CompilerOutput({
  output,
  outputClass,
}: CompilerOutputProps) {
  return (
    <div
      dir="ltr"
      lang="en"
      role="status"
      aria-label="خروجی کامپایلر"
      className={clsx(styles.output, styles[outputClass])}
    >
      {output}
    </div>
  );
}
