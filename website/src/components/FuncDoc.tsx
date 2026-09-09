import type { FuncDoc as FuncDocType } from "../types/function-docs";
import styles from "./FuncDoc.module.css";

interface FuncDocProps {
  doc: FuncDocType;
}

export default function FuncDoc({ doc }: FuncDocProps) {
  return (
    <details>
      <summary>{doc.description}</summary>
      <div className={styles.function}>
        تابع
        <span className={styles.signature}> {doc.function_name} </span>
        <a
          className={styles.docsLink}
          href={doc.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          مستندات کامل
        </a>
        <dl className={styles.args}>
          {doc.args && doc.args.length > 0 && (
            <>
              <dt>پارامترها:</dt>
              {doc.args.map((arg, index) => (
                <dd key={index}>
                  <code>
                    {arg.type} {arg.name}
                  </code>
                  {arg.description}
                </dd>
              ))}
            </>
          )}
        </dl>
        {doc.returns && (
          <>
            {doc.returns.description.success ? (
              <>
                <div>در صورت موفقیت، {doc.returns.description.success} برمی‌گرداند</div>
                <div>در صورت خطا، {doc.returns.description.error} برمی‌گرداند</div>
              </>
            ) : (
              <>مقدار بازگشتی: {doc.returns.description}</>
            )}
          </>
        )}
      </div>
    </details>
  );
}
