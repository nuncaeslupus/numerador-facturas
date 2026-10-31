import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PDFDocument } from "@cantoo/pdf-lib";
import { unzipSync } from "fflate";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "../mcp/manifest.json";
import pkg from "../mcp/package.json";
import registry from "../mcp/server.json";
import { createServer } from "../mcp/server";

const disk = vi.hoisted(() => ({ failOn: "", someoneElse: false }));
vi.mock("node:fs/promises", async (actual) => {
  const real = await actual<typeof import("node:fs/promises")>();
  const writeFile: typeof real.writeFile = async (file, ...rest) => {
    if (!disk.failOn || !String(file).endsWith(disk.failOn)) return real.writeFile(file, ...rest);
    if (!disk.someoneElse) throw new Error("ENOSPC");
    await real.writeFile(file, "ajeno");
    throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
  };
  return { ...real, writeFile };
});

let dir: string;
const password = randomUUID();

async function connect() {
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
  return client;
}

async function call(args: Record<string, unknown>) {
  const client = await connect();
  const r = await client.callTool({ name: "number_invoices", arguments: args });
  const { text } = (r.content as { text: string }[])[0];
  return { isError: r.isError === true, text, report: r.isError ? null : JSON.parse(text) };
}

async function addPdf(name: string, userPassword?: string): Promise<string> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  if (userPassword) {
    await doc.save();
    doc.encrypt({ userPassword, ownerPassword: `${userPassword}-owner` });
  }
  const file = path.join(dir, name);
  await writeFile(file, await doc.save());
  return file;
}

async function textOf(file: string): Promise<string> {
  const pdf = await getDocument({ data: new Uint8Array(await readFile(file)) }).promise;
  const { items } = await (await pdf.getPage(1)).getTextContent();
  return items.map((i) => ("str" in i ? i.str : "")).join("");
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "numerador-mcp-"));
});

describe("number_invoices", () => {
  it("test_tool_folder_numbers_in_natural_order_into_new_copies", async () => {
    const ten = await addPdf("f10.pdf");
    await addPdf("f2.pdf");
    await writeFile(path.join(dir, "notas.txt"), "no soy un PDF");
    const original = await readFile(ten);

    const { report } = await call({ paths: [dir], start: 500 });

    expect(report.outputDir).toBe(path.join(dir, "numeradas"));
    expect(report.files.map((f: { number: string }) => f.number)).toEqual(["F-0500", "F-0501"]);
    expect(path.basename(report.files[0].source)).toBe("f2.pdf");
    expect(await textOf(report.files[1].output)).toBe("F-0501");
    expect(await readFile(ten)).toEqual(original);
  });

  it("test_tool_end_only_counts_back_from_the_last_number", async () => {
    await addPdf("a.pdf");
    await addPdf("b.pdf");
    const { report } = await call({ paths: [dir], end: 20 });
    expect(report.files.map((f: { number: string }) => f.number)).toEqual(["F-0019", "F-0020"]);
  });

  it("test_tool_sort_by_date_and_given_order", async () => {
    const a = await addPdf("a.pdf");
    const b = await addPdf("b.pdf");
    await utimes(a, new Date(2000), new Date(2000));
    await utimes(b, new Date(1000), new Date(1000));
    const first = async (args: object) =>
      (await call({ dry_run: true, ...args })).report.files[0].source;
    expect(await first({ paths: [dir], sort_by: "date" })).toBe(b);
    expect(await first({ paths: [b, a], sort_by: "given" })).toBe(b);
  });

  it("test_tool_dry_run_writes_nothing", async () => {
    await addPdf("a.pdf");
    const { report } = await call({ paths: [dir], dry_run: true });
    expect(report.files).toHaveLength(1);
    expect(await readdir(dir)).toEqual(["a.pdf"]);
  });

  it("test_tool_merge_and_zip_hold_every_invoice", async () => {
    await addPdf("a.pdf");
    await addPdf("b.pdf");
    const { report } = await call({ paths: [dir], merge: true, zip: true });
    const merged = await PDFDocument.load(await readFile(report.merged));
    expect(merged.getPageCount()).toBe(2);
    expect(path.basename(report.merged)).toBe("facturas_F-0001_a_F-0002.pdf");
    expect(Object.keys(unzipSync(await readFile(report.zip)))).toHaveLength(2);
  });

  it("test_tool_never_overwrites_a_previous_run", async () => {
    await addPdf("a.pdf");
    const { report } = await call({ paths: [path.join(dir, "a.pdf")] });
    const before = await stat(report.files[0].output);

    const again = await call({ paths: [path.join(dir, "a.pdf")] });

    expect(again.isError).toBe(true);
    expect(again.text).toContain("no se sobrescriben");
    expect((await stat(report.files[0].output)).mtimeMs).toBe(before.mtimeMs);
  });

  it("test_tool_locked_file_stops_the_whole_batch_until_password_given", async () => {
    await addPdf("a.pdf");
    await addPdf("b.pdf", password);

    const locked = await call({ paths: [dir] });
    expect(locked.isError).toBe(true);
    expect(locked.text).toContain("b.pdf");
    expect(await readdir(dir)).toEqual(["a.pdf", "b.pdf"]);

    const { report } = await call({ paths: [dir], password });
    expect(await textOf(report.files[1].output)).toBe("F-0002");
  });

  it("test_tool_unreadable_file_stops_the_whole_batch", async () => {
    await addPdf("a.pdf");
    await writeFile(path.join(dir, "roto.pdf"), "no soy un PDF");
    const r = await call({ paths: [dir] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Ilegibles");
    expect(await readdir(dir)).toEqual(["a.pdf", "roto.pdf"]);
  });

  it.each([0.1, 0.3, 0.6, 0.9])("test_tool_cut_off_file_stops_the_batch_at_%d", async (part) => {
    await addPdf("a.pdf");
    const cut = path.join(dir, "cortado.pdf");
    const whole = await readFile(await addPdf("cortado.pdf"));
    await writeFile(cut, whole.subarray(0, Math.floor(whole.length * part)));
    const r = await call({ paths: [dir] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("cortado.pdf");
    expect(await readdir(dir)).toEqual(["a.pdf", "cortado.pdf"]);
  });

  it("test_tool_file_damaged_in_the_middle_stops_the_batch", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage([200, 200]).drawText(`página ${i}`);
    const bytes = await doc.save({ useObjectStreams: false });
    bytes.fill(0, Math.floor(bytes.length * 0.3), Math.floor(bytes.length * 0.6));
    await writeFile(path.join(dir, "danado.pdf"), bytes);
    const r = await call({ paths: [dir] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("danado.pdf");
  });

  it("test_tool_encrypted_file_with_lost_pages_stops_the_batch", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage([200, 200]).drawText(`página ${i}`);
    await doc.save();
    doc.encrypt({ userPassword: password, ownerPassword: randomUUID() });
    const bytes = await doc.save({ useObjectStreams: false });
    bytes.fill(0, Math.floor(bytes.length * 0.3), Math.floor(bytes.length * 0.6));
    await writeFile(path.join(dir, "danado.pdf"), bytes);
    expect((await call({ paths: [dir], password })).isError).toBe(true);
  });

  it("test_tool_position_off_the_page_is_refused", async () => {
    await addPdf("a.pdf");
    const r = await call({ paths: [dir], x_mm: 500 });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("a.pdf");
    expect(await readdir(dir)).toEqual(["a.pdf"]);
  });

  it("test_tool_pdf_without_pages_stops_the_batch", async () => {
    const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });
    await writeFile(path.join(dir, "vacio.pdf"), empty);
    expect((await call({ paths: [dir] })).isError).toBe(true);
  });

  it("test_tool_failed_write_removes_what_it_wrote", async () => {
    await addPdf("a.pdf");
    await addPdf("b.pdf");
    disk.failOn = ".zip";
    const r = await call({ paths: [dir], zip: true });
    disk.failOn = "";
    expect(r.isError).toBe(true);
    expect(await readdir(path.join(dir, "numeradas"))).toEqual([]);
    expect((await call({ paths: [dir], zip: true })).isError).toBeFalsy();
  });

  it("test_tool_failed_write_keeps_a_file_it_did_not_write", async () => {
    await addPdf("a.pdf");
    disk.failOn = ".zip";
    disk.someoneElse = true;
    const r = await call({ paths: [dir], zip: true });
    disk.failOn = "";
    disk.someoneElse = false;
    expect(r.isError).toBe(true);
    expect(await readdir(path.join(dir, "numeradas"))).toEqual(["facturas_F-0001_a_F-0001.zip"]);
  });

  it("test_tool_symlinked_invoice_is_numbered", async () => {
    const target = await addPdf("real.pdf");
    const other = await mkdtemp(path.join(tmpdir(), "enlaces-"));
    await symlink(target, path.join(other, "enlace.pdf"));
    expect((await call({ paths: [other] })).report.count).toBe(1);
  });

  it("test_tool_template_the_font_cannot_write_is_refused", async () => {
    await addPdf("a.pdf");
    const r = await call({ paths: [dir], template: "請求{n}" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("WinAnsi");
    expect(await readdir(dir)).toEqual(["a.pdf"]);
  });

  it("test_tool_accented_template_is_accepted", async () => {
    await addPdf("a.pdf");
    const { report } = await call({ paths: [dir], template: "Nº€-{n}" });
    expect(report.files[0].number).toBe("Nº€-1");
  });

  it.each([
    [{ paths: ["facturas"] }, "absoluta"],
    [{ paths: ["/no/existe"] }, "ENOENT"],
  ])("test_tool_bad_paths_are_reported_%#", async (args, message) => {
    const r = await call(args);
    expect(r.isError).toBe(true);
    expect(r.text).toContain(message);
  });

  it("test_tool_relative_output_dir_is_rejected", async () => {
    await addPdf("a.pdf");
    const r = await call({ paths: [dir], output_dir: "salida" });
    expect(r.text).toContain("absoluta");
  });

  it("test_tool_folder_without_pdfs_is_reported", async () => {
    expect((await call({ paths: [dir] })).text).toContain("No hay ningún PDF");
  });
});

describe("metadata", () => {
  it("test_server_tells_the_llm_to_prefer_it_over_own_scripts", async () => {
    const client = await connect();
    expect(client.getInstructions()).toMatch(/Prefer it to writing your own script/);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["number_invoices"]);
    expect(tools[0].annotations).toMatchObject({ destructiveHint: false, openWorldHint: false });
  });

  it("test_version_and_name_agree_across_package_manifest_and_registry", () => {
    expect(manifest.version).toBe(pkg.version);
    expect(registry.version).toBe(pkg.version);
    expect(registry.packages[0].version).toBe(pkg.version);
    expect(registry.name).toBe(pkg.mcpName);
    expect(registry.packages[0].identifier).toBe(pkg.name);
  });
});
