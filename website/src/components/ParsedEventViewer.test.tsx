import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ParsedEventViewer from "./ParsedEventViewer";
import { debTypeRegistry } from "../lib/deb-type-registry";

afterEach(() => debTypeRegistry.set([]));

describe("ParsedEventViewer", () => {
  it("renders a recoverable error for truncated scalar data", () => {
    debTypeRegistry.set([
      {
        counter: 1,
        type_constant: 2,
        type_name: "int",
        label: "value",
        is_union: false,
        is_signed: true,
      },
    ]);
    const markup = renderToStaticMarkup(
      createElement(ParsedEventViewer, {
        data: [2, 1, 4, 0],
        typeRegistry: {},
      }),
    );
    expect(markup).toContain("طول یا اندازهٔ دادهٔ عددی نامعتبر است");
  });

  it("renders a signed 64-bit scalar in an isolated LTR field", () => {
    debTypeRegistry.set([
      {
        counter: 1,
        type_constant: 2,
        type_name: "long",
        label: "value",
        is_union: false,
        is_signed: true,
      },
    ]);
    const markup = renderToStaticMarkup(
      createElement(ParsedEventViewer, {
        data: [2, 1, 8, 255, 255, 255, 255, 255, 255, 255, 255],
        typeRegistry: {},
      }),
    );
    expect(markup).toContain("-1");
    expect(markup).toContain('dir="ltr"');
  });
});
