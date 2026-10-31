import { defineConfig } from "vite";

// One self-contained file, so `npx` and the .mcpb install no dependencies at all.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: "mcp/main.ts",
    outDir: "mcp/dist",
    target: "node20",
    license: { fileName: "THIRD-PARTY-LICENSES.md" },
    rollupOptions: {
      output: { entryFileNames: "server.mjs", banner: "#!/usr/bin/env node" },
    },
  },
});
