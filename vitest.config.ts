import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // `react-server` is the export condition Next uses to resolve the `server-only`
  // package to its no-op empty.js (see node_modules/server-only/package.json's
  // exports map). Without it, importing lib/data.ts or lib/notion.ts under test
  // hits the throwing index.js. Tests run in the node (SSR) environment, so the
  // custom condition must go under ssr.resolve.conditions — plain
  // resolve.conditions only applies to Vitest's client/browser environment.
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  resolve: {
    // Mirror tsconfig.json's paths: "@/*" -> "./*".
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
