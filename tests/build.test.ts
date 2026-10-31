import { existsSync, readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { expect, it } from "vitest";

// Runs after `vite build` in `make check`; skipped when there is no dist/.
it.runIf(existsSync("dist/index.html"))("test_build_outputs_index_html_with_csp", () => {
  const html = readFileSync("dist/index.html", "utf8");
  expect(html).toMatch(/http-equiv="Content-Security-Policy"[^>]*connect-src (?:'|&#39;)self/);
  expect(existsSync("dist/pdfjs/standard_fonts")).toBe(true);
});

it.runIf(existsSync("dist/index.html"))("test_build_serves_the_mcp_download", () => {
  expect(existsSync("dist/llms.txt")).toBe(true);
  expect(Object.keys(unzipSync(readFileSync("dist/numerador-facturas.mcpb"))).sort()).toEqual([
    "LICENSE",
    "THIRD-PARTY-LICENSES.md",
    "manifest.json",
    "server/index.mjs",
  ]);
});

it("test_src_makes_no_network_calls", () => {
  const files = ["main", "stamp", "format", "order", "output", "position"].map(
    (f) => `src/${f}.ts`,
  );
  for (const f of [...files, "mcp/number.ts", "mcp/server.ts", "mcp/main.ts"]) {
    expect(readFileSync(f, "utf8")).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  }
});

// The MCP's privacy promise rests on what the bundle holds, not just on our own sources.
it.runIf(existsSync("mcp/dist/server.mjs"))("test_mcp_bundle_opens_no_sockets", () => {
  expect(readFileSync("mcp/dist/server.mjs", "utf8")).not.toMatch(
    /(?:from |require(?:\$\d+)?\()"(?:node:)?(?:net|tls|http|https|dgram|dns)"/,
  );
});
