import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Runs after `vite build` in `make check`; skipped when there is no dist/.
it.runIf(existsSync("dist/index.html"))("test_build_outputs_index_html_with_csp", () => {
  const html = readFileSync("dist/index.html", "utf8");
  expect(html).toMatch(/http-equiv="Content-Security-Policy"[^>]*connect-src (?:'|&#39;)self/);
  expect(existsSync("dist/pdfjs/standard_fonts")).toBe(true);
});

it("test_src_makes_no_network_calls", () => {
  for (const f of ["main", "stamp", "format", "order", "output", "position"]) {
    expect(readFileSync(`src/${f}.ts`, "utf8")).not.toMatch(
      /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/,
    );
  }
});
