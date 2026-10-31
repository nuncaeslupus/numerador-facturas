// Packs the bundled MCP server as a .mcpb into public/, so the web serves it as a download.
import { readFileSync, writeFileSync } from "node:fs";
import { zipSync } from "fflate";

writeFileSync(
  "public/numerador-facturas.mcpb",
  zipSync({
    "manifest.json": readFileSync("mcp/manifest.json"),
    "server/index.mjs": readFileSync("mcp/dist/server.mjs"),
    LICENSE: readFileSync("LICENSE"),
    "THIRD-PARTY-LICENSES.md": readFileSync("mcp/dist/THIRD-PARTY-LICENSES.md"),
  }),
);
