import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "@cantoo/pdf-lib";
import { formatNumber, resolveRange } from "../src/format";
import { sortFiles } from "../src/order";
import { outputName, zipFiles } from "../src/output";
import {
  checkEncodable,
  mergePdfs,
  needsPassword,
  openPdf,
  stampPdf,
  visibleSize,
  type StampOptions,
} from "../src/stamp";

export interface NumberRequest {
  paths: string[];
  template: string;
  start?: number;
  end?: number;
  sortBy: "name" | "date" | "given";
  outputDir?: string;
  merge: boolean;
  zip: boolean;
  password?: string;
  dryRun: boolean;
  stamp: StampOptions;
}

export interface NumberReport {
  dryRun: boolean;
  count: number;
  outputDir: string;
  files: { source: string; number: string; output: string }[];
  merged?: string;
  zip?: string;
}

type Opened = Awaited<ReturnType<typeof openPdf>>;

const isPdf = (p: string) => path.extname(p).toLowerCase() === ".pdf";

/** Absolute paths only: a server's working directory is whatever its client started it in. */
async function listPdfs(paths: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const p of paths) {
    if (!path.isAbsolute(p)) throw new Error(`La ruta debe ser absoluta: ${p}`);
    if (!(await stat(p)).isDirectory()) {
      found.add(path.normalize(p));
      continue;
    }
    // Sorted, so the order never depends on the filesystem; stat, so symlinks count as files.
    for (const name of (await readdir(p)).sort()) {
      const file = path.join(p, name);
      if (isPdf(name) && (await stat(file)).isFile()) found.add(file);
    }
  }
  if (!found.size) throw new Error("No hay ningún PDF en las rutas indicadas");
  return [...found];
}

async function inOrder(files: string[], by: NumberRequest["sortBy"]): Promise<string[]> {
  if (by === "given") return files;
  const items = await Promise.all(
    files.map(async (file) => ({
      file,
      name: path.basename(file),
      lastModified: (await stat(file)).mtimeMs,
    })),
  );
  return sortFiles(items, by).map((i) => i.file);
}

/**
 * pdf-lib recovers what it can from a damaged file and saves the rest as if nothing had happened,
 * losing pages. Strict loading refuses most of those (but also sound encrypted files, so they load
 * normally), the end marker catches a download that stopped halfway (viewers also look for it in
 * the last 1024 bytes), and the page tree's own count catches lost pages.
 * ponytail: damage inside a page's content stream still passes; only rendering would notice.
 */
async function assertIntact(raw: Buffer, pdf: Opened, password = ""): Promise<void> {
  const doc = await PDFDocument.load(
    raw,
    pdf.bytes === raw ? { throwOnInvalidObject: true } : { password, ignoreEncryption: true },
  );
  const pages = doc.getPageCount();
  if (!pages || pages !== doc.catalog.Pages().Count().asNumber()) {
    throw new Error("Faltan páginas");
  }
  if (!raw.subarray(-1024).includes("%%EOF")) throw new Error("Archivo incompleto");
}

/**
 * Opens every file before numbering anything: unlike the web page, which skips what it cannot
 * read and shows it, an unattended run must not leave a gap in a correlative series.
 */
async function openAll(files: string[], password?: string): Promise<Opened[]> {
  const opened: Opened[] = [];
  const locked: string[] = [];
  const broken: string[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(file);
      const pdf = await openPdf(raw, password);
      await assertIntact(raw, pdf, password);
      opened.push(pdf);
    } catch (e) {
      (needsPassword(e) ? locked : broken).push(file);
    }
  }
  const problems = [
    ...(locked.length ? [`Protegidos con contraseña: ${locked.join(", ")}`] : []),
    ...(broken.length ? [`Ilegibles o incompletos: ${broken.join(", ")}`] : []),
  ];
  if (problems.length) throw new Error(`No se ha numerado nada. ${problems.join(". ")}`);
  return opened;
}

async function assertFree(targets: string[]): Promise<void> {
  const taken: string[] = [];
  for (const t of targets) {
    const found = await stat(t).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
    if (found) taken.push(t);
  }
  if (taken.length) throw new Error(`Ya existen, no se sobrescriben: ${taken.join(", ")}`);
}

/**
 * Numbers a batch into new files: originals are never touched and nothing is overwritten.
 * ponytail: holds the whole batch in memory, parsed; thousands of large scans would need batches.
 */
export async function numberInvoices(r: NumberRequest): Promise<NumberReport> {
  const files = await inOrder(await listPdfs(r.paths), r.sortBy);
  const opened = await openAll(files, r.password);

  const offPage = files.filter((_, i) =>
    opened[i].doc.getPages().some((page) => {
      const { width, height } = visibleSize(page);
      return r.stamp.xMm >= width || r.stamp.yMm >= height;
    }),
  );
  if (offPage.length) {
    throw new Error(`La posición queda fuera de la página en: ${offPage.join(", ")}`);
  }

  const { start } = resolveRange(files.length, r.start, r.end);
  const numbers = files.map((_, i) => formatNumber(r.template, start + i));
  await checkEncodable(numbers[0], r.stamp.font);

  const outputDir = r.outputDir ?? path.join(path.dirname(files[0]), "numeradas");
  if (!path.isAbsolute(outputDir)) throw new Error(`La ruta debe ser absoluta: ${outputDir}`);
  const output = (name: string) => path.join(outputDir, name);
  const plan = files.map((source, i) => ({
    source,
    number: numbers[i],
    output: output(outputName(numbers[i], path.basename(source))),
  }));
  const label = outputName(`facturas_${numbers[0]}_a_${numbers[numbers.length - 1]}`, "").replace(
    /_$/,
    "",
  );
  const merged = r.merge ? output(`${label}.pdf`) : undefined;
  const zip = r.zip ? output(`${label}.zip`) : undefined;
  const report = { dryRun: r.dryRun, count: files.length, outputDir, files: plan, merged, zip };

  await assertFree([
    ...plan.map((p) => p.output),
    ...(merged ? [merged] : []),
    ...(zip ? [zip] : []),
  ]);
  if (r.dryRun) return report;

  // Everything is built before the first write, and a failed write removes what this run wrote:
  // a partial batch would leave a gap in the series and block the retry.
  const stamped: Uint8Array[] = [];
  for (const [i, { bytes }] of opened.entries())
    stamped.push(await stampPdf(bytes, numbers[i], r.stamp));

  const outputs: [string, Uint8Array][] = plan.map((p, i) => [p.output, stamped[i]]);
  if (merged) outputs.push([merged, await mergePdfs(stamped)]);
  if (zip) {
    const entries = plan.map((p, i) => ({ name: path.basename(p.output), data: stamped[i] }));
    outputs.push([zip, zipFiles(entries)]);
  }

  await mkdir(outputDir, { recursive: true });
  const written: string[] = [];
  try {
    for (const [file, data] of outputs) {
      written.push(file);
      await writeFile(file, data, { flag: "wx" });
    }
  } catch (e) {
    // EEXIST: that file is not ours, it appeared after the check above.
    if ((e as NodeJS.ErrnoException).code === "EEXIST") written.pop();
    await Promise.all(written.map((f) => rm(f, { force: true })));
    throw e;
  }
  return report;
}
