/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// No request may leave the page: everything (worker, fonts, wasm) is served from self.
// Build-only, because the dev server needs inline scripts and a websocket for HMR.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export default defineConfig({
  base: "/numerador-facturas/",
  plugins: [
    {
      name: "csp",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head",
        },
      ],
    },
  ],
  test: { environment: "node" },
});
