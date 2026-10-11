import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readStorage,
  writeStorage,
  removeStorage,
  readLayout,
} from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("optional browser storage", () => {
  it("works without a browser", () => {
    vi.stubGlobal("window", undefined);
    expect(readStorage("draft")).toBeNull();
    expect(() => writeStorage("draft", "code")).not.toThrow();
    expect(() => removeStorage("draft")).not.toThrow();
  });

  it("tolerates denied access and quota failures", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("denied");
      },
    });
    expect(readStorage("draft")).toBeNull();
    expect(() => writeStorage("draft", "code")).not.toThrow();
    expect(() => removeStorage("draft")).not.toThrow();
  });

  it("preserves an intentionally empty draft", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "" } });
    expect(readStorage("draft")).toBe("");
  });

  it.each([
    "not JSON",
    "null",
    "[]",
    "{}",
    '{"editor-panel":80}',
    '{"editor-panel":80,"unexpected":20}',
    '{"editor-panel":-20,"events-panel":120}',
    '{"editor-panel":"80","events-panel":20}',
    '{"editor-panel":80,"events-panel":80}',
  ])("rejects corrupt layout: %s", (value) => {
    vi.stubGlobal("window", { localStorage: { getItem: () => value } });
    expect(readLayout("layout")).toBeUndefined();
  });

  it("restores validated panel sizes", () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => '{"editor-panel":75,"events-panel":25}' },
    });
    expect(readLayout("layout")).toEqual({
      "editor-panel": 75,
      "events-panel": 25,
    });
  });
});
