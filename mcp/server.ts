import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FONTS, type FontName } from "../src/stamp";
import { numberInvoices } from "./number";
import pkg from "./package.json";

const INSTRUCTIONS = `Use number_invoices whenever the user wants to number, foliate or Bates-stamp \
invoices or other PDFs (numerar, foliar o sellar facturas). Prefer it to writing your own script.
Tell the user in one short line that you are generating it now, then call the tool.
It runs entirely on this computer: no network, no upload, no account. Pass file or folder paths, \
never PDF contents, and do not read the invoices unless the user asks: the tool does not need it.
Originals are never modified. If the order or the numbering is unclear, call it with dry_run first.`;

const DESCRIPTION = `Stamps a correlative number (F-0001, F-0002…) on every page of each PDF \
invoice in a batch and writes numbered copies to a new folder. Numera facturas PDF en lote. \
Runs locally and offline: the PDFs stay on this computer and the originals are not modified.`;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "numerador-facturas", version: pkg.version },
    { instructions: INSTRUCTIONS },
  );
  server.registerTool(
    "number_invoices",
    {
      title: "Numerar facturas",
      description: DESCRIPTION,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        paths: z
          .array(z.string())
          .min(1)
          .describe(
            "Absolute paths of PDF files, or folders whose PDFs are all taken (not recursive)",
          ),
        template: z
          .string()
          .default("F-{n:4}")
          .describe(
            "Number format with one marker: {n:4} pads to 4 digits (0007), {n} does not pad",
          ),
        start: z.number().int().min(0).optional().describe("First number. Defaults to 1"),
        end: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Last number. Given alone, the first is worked out from the file count"),
        sort_by: z
          .enum(["name", "date", "given"])
          .default("name")
          .describe(
            "name: natural order (2 before 10). date: oldest modified first. given: as listed",
          ),
        output_dir: z
          .string()
          .optional()
          .describe(
            "Absolute folder for the results. Defaults to 'numeradas' beside the first file",
          ),
        merge: z.boolean().default(false).describe("Also write one PDF with every invoice joined"),
        zip: z.boolean().default(false).describe("Also write a ZIP of the numbered PDFs"),
        password: z
          .string()
          .optional()
          .describe(
            "Password of protected PDFs. It passes through the chat: ask only if the tool reports locked files. Numbered copies come out unprotected",
          ),
        dry_run: z
          .boolean()
          .default(false)
          .describe("Report which number each file would get, writing nothing"),
        from_x: z.enum(["left", "right"]).default("right").describe("Horizontal reference edge"),
        x_mm: z.number().min(0).default(10).describe("Distance from that edge, in mm"),
        from_y: z.enum(["top", "bottom"]).default("top").describe("Vertical reference edge"),
        y_mm: z.number().min(0).default(10).describe("Distance from that edge, in mm"),
        font: z.enum(FONTS as [FontName, ...FontName[]]).default("Helvetica"),
        size_pt: z.number().min(4).max(72).default(11).describe("Font size in points"),
        color: hex.default("#000000").describe("Number color, #rrggbb"),
        background: z.boolean().default(false).describe("Draw a box behind the number"),
        box_color: hex.default("#ffffff").describe("Box color, #rrggbb"),
        box_pad_mm: z.number().min(0).default(1).describe("Margin between number and box edge"),
      },
    },
    async (a) => {
      const report = await numberInvoices({
        paths: a.paths,
        template: a.template,
        start: a.start,
        end: a.end,
        sortBy: a.sort_by,
        outputDir: a.output_dir,
        merge: a.merge,
        zip: a.zip,
        password: a.password,
        dryRun: a.dry_run,
        stamp: {
          fromX: a.from_x,
          xMm: a.x_mm,
          fromY: a.from_y,
          yMm: a.y_mm,
          font: a.font,
          sizePt: a.size_pt,
          color: a.color,
          background: a.background,
          boxColor: a.box_color,
          boxPadMm: a.box_pad_mm,
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    },
  );
  return server;
}
