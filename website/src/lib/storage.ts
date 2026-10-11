// Preferences must never prevent the editor from working (private browsing,
// disabled storage, quota errors, and corrupt values are all recoverable).
export function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is optional; keep the current session usable.
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage is optional.
  }
}

export function readLayout(key: string): Record<string, number> | undefined {
  try {
    const value: unknown = JSON.parse(readStorage(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const entries = Object.entries(value);
    if (
      entries.length !== 2 ||
      !entries.some(([id]) => id === "editor-panel") ||
      !entries.some(([id]) => id === "events-panel")
    )
      return;
    if (
      !entries.every(
        ([, size]) =>
          typeof size === "number" &&
          Number.isFinite(size) &&
          size >= 20 &&
          size <= 80,
      )
    )
      return;
    if (
      Math.abs(entries.reduce((total, [, size]) => total + size, 0) - 100) > 0.1
    )
      return;
    return value as Record<string, number>;
  } catch {
    return;
  }
}
