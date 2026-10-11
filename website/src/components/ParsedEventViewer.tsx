import { useState } from "react";
import type { TypeInfo } from "../types/typeinfo";
import { parseStruct, type ParsedField } from "../lib/struct-parser";
import { debTypeRegistry } from "../lib/deb-type-registry";
import styles from "./ParsedEventViewer.module.css";

interface ParsedEventViewerProps {
  data: number[];
  typeRegistry: { [name: string]: TypeInfo };
}

interface ParsedFieldProps {
  field: ParsedField;
  path: string;
  charArrayModes: { [path: string]: "string" | "hex" };
  numberModes: { [path: string]: "decimal" | "hex" };
  onToggleString: (path: string) => void;
  onToggleNumber: (path: string) => void;
  depth: number;
}

function escapeNonPrintable(str: string): string {
  return str
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) {
        return char;
      }
      if (char === "\n") return "\\n";
      if (char === "\r") return "\\r";
      if (char === "\t") return "\\t";
      if (char === "\0") return "\\0";
      return "\\u" + code.toString(16).padStart(4, "0");
    })
    .join("");
}

function ParsedFieldComponent({
  field,
  path,
  charArrayModes,
  numberModes,
  onToggleString,
  onToggleNumber,
  depth,
}: ParsedFieldProps) {
  const indentStyle = { paddingInlineStart: `${depth * 0.5}rem` };

  if (field.value.kind === "scalar") {
    const mode = numberModes[path] || "decimal";
    let displayValue: string;

    if (mode === "decimal") {
      displayValue = field.value.value.toString();
    } else {
      const unsigned = BigInt.asUintN(
        field.size * 8,
        BigInt(field.value.value),
      );
      displayValue = "0x" + unsigned.toString(16);
    }

    return (
      <div className={styles.field}>
        <span className={styles.fieldName} style={indentStyle}>
          {field.name}
        </span>
        <button
          className={styles.toggleButton}
          onClick={() => onToggleNumber(path)}
          aria-label={`تغییر نمایش عدد ${field.name}`}
        >
          [
          <span className={mode === "decimal" ? styles.activeMode : ""}>
            0-9
          </span>
          |<span className={mode === "hex" ? styles.activeMode : ""}>0x</span>]
        </button>
        <span className={styles.fieldValue}>{displayValue}</span>
      </div>
    );
  }

  if (field.value.kind === "string") {
    const mode = charArrayModes[path] || "string";
    let displayValue: string;

    if (mode === "string") {
      const trimmed = field.value.value.replace(/\0+$/, "");
      const escaped = escapeNonPrintable(trimmed);
      if (trimmed.length !== field.value.value.length) {
        displayValue = `"${escaped}\\0"`;
      } else {
        displayValue = `"${escaped}"`;
      }
    } else {
      displayValue = field.value.rawBytes
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
    }

    return (
      <div className={styles.field}>
        <span className={styles.fieldName} style={indentStyle}>
          {field.name}
        </span>
        <button
          className={styles.toggleButton}
          onClick={() => onToggleString(path)}
          aria-label={`تغییر نمایش رشتهٔ ${field.name}`}
        >
          [
          <span className={mode === "string" ? styles.activeMode : ""}>
            a-z
          </span>
          |<span className={mode === "hex" ? styles.activeMode : ""}>0x</span>]
        </button>
        <span className={styles.fieldValue}>{displayValue}</span>
      </div>
    );
  }

  if (field.value.kind === "struct") {
    if (field.type == "in_addr") {
      const s_addr_field = field.value.fields.find((f) => f.name === "s_addr");
      if (!s_addr_field || s_addr_field.value.kind !== "scalar") {
        return <div className={styles.field}>ساختار in_addr نامعتبر است</div>;
      }

      const value = s_addr_field.value.value;
      const numValue = typeof value === "bigint" ? Number(value) : value;

      const byte1 = (numValue >>> 0) & 0xff;
      const byte2 = (numValue >>> 8) & 0xff;
      const byte3 = (numValue >>> 16) & 0xff;
      const byte4 = (numValue >>> 24) & 0xff;

      const mode = numberModes[path] || "decimal";
      let displayValue: string;

      if (mode === "decimal") {
        displayValue = `${byte1}.${byte2}.${byte3}.${byte4}`;
      } else {
        displayValue = "0x" + numValue.toString(16).padStart(8, "0");
      }

      return (
        <div className={styles.field}>
          <span className={styles.fieldName} style={indentStyle}>
            {field.name}
          </span>
          <button
            className={styles.toggleButton}
            onClick={() => onToggleNumber(path)}
            aria-label={`تغییر نمایش آدرس ${field.name}`}
          >
            [
            <span className={mode === "decimal" ? styles.activeMode : ""}>
              IP
            </span>
            |<span className={mode === "hex" ? styles.activeMode : ""}>0x</span>
            ]
          </button>
          <span className={styles.fieldValue}>{displayValue}</span>
        </div>
      );
    }
    return (
      <>
        <div className={styles.field}>
          <span className={styles.fieldName} style={indentStyle}>
            {field.name}
          </span>
          <span className={styles.togglePlaceholder}></span>
          <span className={styles.fieldValue}></span>
        </div>
        {field.value.fields.map((subField, i) => (
          <ParsedFieldComponent
            key={i}
            field={subField}
            path={`${path}.${subField.name}`}
            charArrayModes={charArrayModes}
            numberModes={numberModes}
            onToggleString={onToggleString}
            onToggleNumber={onToggleNumber}
            depth={depth + 1}
          />
        ))}
      </>
    );
  }

  if (field.value.kind === "array") {
    const nestedIndentStyle = { paddingInlineStart: `${(depth + 1) * 1.5}rem` };
    return (
      <>
        <div className={styles.field}>
          <span className={styles.fieldName} style={indentStyle}>
            {field.name}
          </span>
          <span className={styles.togglePlaceholder}></span>
          <span className={styles.fieldValue}></span>
        </div>
        {field.value.elements.map((element, i) => (
          <div key={i} className={styles.field}>
            <span className={styles.fieldName} style={nestedIndentStyle}>
              [{i}]
            </span>
            <span className={styles.togglePlaceholder}></span>
            <span className={styles.fieldValue}>
              {element.kind === "scalar"
                ? element.value.toString()
                : JSON.stringify(element, (_, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                  )}
            </span>
          </div>
        ))}
      </>
    );
  }

  return null;
}

export default function ParsedEventViewer({
  data,
  typeRegistry,
}: ParsedEventViewerProps) {
  const [charArrayModes, setCharArrayModes] = useState<{
    [path: string]: "string" | "hex";
  }>({});

  const [numberModes, setNumberModes] = useState<{
    [path: string]: "decimal" | "hex";
  }>({});

  const toggleCharArrayMode = (path: string) => {
    setCharArrayModes((prev) => ({
      ...prev,
      [path]: prev[path] === "hex" ? "string" : "hex",
    }));
  };

  const toggleNumberMode = (path: string) => {
    setNumberModes((prev) => ({
      ...prev,
      [path]: prev[path] === "hex" ? "decimal" : "hex",
    }));
  };

  if (data.length < 2) {
    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <span className={styles.eventError}>خطای خواندن رویداد</span>
        </div>
        <div className={styles.errorMessage}>
          داده کوتاه است؛ حداقل ۲ بایت برای شناسهٔ نوع لازم است. تعداد بایت‌ها:{" "}
          {data.length.toLocaleString("fa-IR")}
        </div>
      </div>
    );
  }

  const typeId = data[0];
  const counter = data[1];

  const debTypeInfo = debTypeRegistry.findByCounter(counter);

  if (!debTypeInfo) {
    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <span className={styles.eventError}>خطای خواندن رویداد</span>
        </div>
        <div className={styles.errorMessage}>
          شناسهٔ رویداد {counter.toLocaleString("fa-IR")} در اطلاعات نوع پیدا
          نشد.
        </div>
      </div>
    );
  }

  const typeName = debTypeInfo.type_name;
  const label = debTypeInfo.label;

  // Handle scalar type (type_id 2) - has 3-byte header with size
  if (typeId === 2) {
    if (
      data.length < 3 ||
      ![1, 2, 4, 8].includes(data[2]) ||
      data.length < 3 + data[2]
    ) {
      return (
        <div className={styles.parsedEvent}>
          <div className={styles.eventHeader}>
            <span className={styles.eventError}>خطای خواندن رویداد</span>
          </div>
          <div className={styles.errorMessage}>
            طول یا اندازهٔ دادهٔ عددی نامعتبر است.
          </div>
        </div>
      );
    }

    const size = data[2];
    const actualData = data.slice(3);
    let value: number | bigint;
    const view = new DataView(new Uint8Array(actualData).buffer);
    const isSigned = debTypeInfo.is_signed || false;

    // Read based on size byte
    if (size === 1) {
      value = isSigned ? view.getInt8(0) : view.getUint8(0);
    } else if (size === 2) {
      value = isSigned ? view.getInt16(0, true) : view.getUint16(0, true);
    } else if (size === 4) {
      value = isSigned ? view.getInt32(0, true) : view.getUint32(0, true);
    } else if (size === 8) {
      value = isSigned ? view.getBigInt64(0, true) : view.getBigUint64(0, true);
    } else {
      value = 0;
    }

    const mode = numberModes["_scalar"] || "decimal";
    let displayValue: string;

    if (mode === "decimal") {
      displayValue = value.toString();
    } else {
      if (typeof value === "bigint") {
        const unsigned = value < 0n ? BigInt.asUintN(size * 8, value) : value;
        displayValue = "0x" + unsigned.toString(16);
      } else if (value < 0) {
        let unsigned: number;
        if (size === 1) {
          unsigned = value & 0xff;
        } else if (size === 2) {
          unsigned = value & 0xffff;
        } else if (size === 4) {
          unsigned = value >>> 0;
        } else {
          unsigned = value;
        }
        displayValue = "0x" + unsigned.toString(16);
      } else {
        displayValue = "0x" + value.toString(16);
      }
    }

    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <bdi dir="ltr" className={styles.eventType}>
            {label}
          </bdi>
          <span className={styles.eventSize}>
            ({size.toLocaleString("fa-IR")} بایت)
          </span>
        </div>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldName}>value</span>
            <button
              className={styles.toggleButton}
              onClick={() => toggleNumberMode("_scalar")}
              aria-label="تغییر نمایش عدد"
            >
              [
              <span className={mode === "decimal" ? styles.activeMode : ""}>
                0-9
              </span>
              |
              <span className={mode === "hex" ? styles.activeMode : ""}>
                0x
              </span>
              ]
            </button>
            <span className={styles.fieldValue}>{displayValue}</span>
          </div>
        </div>
      </div>
    );
  }

  // Handle string type (type_id 3) - 3-byte header
  const actualData = data.slice(3);

  if (typeId === 3) {
    const mode = charArrayModes["_string"] || "string";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const stringValue = decoder.decode(new Uint8Array(actualData));
    let displayValue: string;

    if (mode === "string") {
      const trimmed = stringValue.replace(/\0+$/, "");
      const escaped = escapeNonPrintable(trimmed);
      if (trimmed.length !== stringValue.length) {
        displayValue = `"${escaped}\\0"`;
      } else {
        displayValue = `"${escaped}"`;
      }
    } else {
      displayValue = actualData
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
    }

    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <bdi dir="ltr" className={styles.eventType}>
            {label}
          </bdi>
          <span className={styles.eventSize}>
            ({actualData.length.toLocaleString("fa-IR")} بایت)
          </span>
        </div>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldName}>value</span>
            <button
              className={styles.toggleButton}
              onClick={() => toggleCharArrayMode("_string")}
              aria-label="تغییر نمایش رشته"
            >
              [
              <span className={mode === "string" ? styles.activeMode : ""}>
                a-z
              </span>
              |
              <span className={mode === "hex" ? styles.activeMode : ""}>
                0x
              </span>
              ]
            </button>
            <span className={styles.fieldValue}>{displayValue}</span>
          </div>
        </div>
      </div>
    );
  }

  // Handle struct type (type_id 4)
  const typeInfo = typeRegistry[typeName];

  if (!typeInfo) {
    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <span className={styles.eventError}>خطای خواندن رویداد</span>
        </div>
        <div className={styles.errorMessage}>
          نوع <bdi dir="ltr">{typeName}</bdi> در اطلاعات نوع پیدا نشد.
        </div>
      </div>
    );
  }

  const parseResult = parseStruct(actualData, typeInfo, typeRegistry);

  if (!parseResult.success) {
    return (
      <div className={styles.parsedEvent}>
        <div className={styles.eventHeader}>
          <bdi dir="ltr" className={styles.eventType}>
            {label}
          </bdi>
          <span className={styles.eventError}>خطای خواندن رویداد</span>
        </div>
        <div dir="ltr" lang="en" className={styles.errorMessage}>
          {parseResult.error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.parsedEvent}>
      <div className={styles.eventHeader}>
        <bdi dir="ltr" className={styles.eventType}>
          {label}
        </bdi>
        <span className={styles.eventSize}>
          ({actualData.length.toLocaleString("fa-IR")} بایت)
        </span>
      </div>
      <div className={styles.fields}>
        {parseResult.parsed!.map((field, i) => (
          <ParsedFieldComponent
            key={i}
            field={field}
            path={field.name}
            charArrayModes={charArrayModes}
            numberModes={numberModes}
            onToggleString={toggleCharArrayMode}
            onToggleNumber={toggleNumberMode}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
