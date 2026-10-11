// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: {
      theme: "css-variables",
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    worker: {
      format: "es",
    },
    server: {
      allowedHosts: ["ebpf.party"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                return "vendor-react";
              }
              if (id.includes("@uiw/react-codemirror")) {
                return "vendor-r-codemirror";
              }
              if (id.includes("@codemirror")) {
                return "vendor-codemirror";
              }
              if (id.includes("react-resizable-panels")) {
                return "vendor-panels";
              }
              if (id.includes("syntax_check")) {
                return "vendor-wasm";
              }
            }
          },
        },
      },
    },
  },
});
