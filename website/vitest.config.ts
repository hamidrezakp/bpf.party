import { defineConfig } from "vitest/config";

export default defineConfig({
  // Astro's tsconfig sets `jsx: preserve`; instruct the oxc transform directly.
  oxc: { jsx: { runtime: "automatic" } },
});
