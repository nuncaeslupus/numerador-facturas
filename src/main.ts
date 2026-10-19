import "./style.css";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import { formatNumber, resolveRange } from "./format";
import { sortFiles } from "./order";
import { outputName, zipFiles } from "./output";
import { offsetsToPoint, pointToOffsets, type FromX, type FromY, type Size } from "./position";
import {
  FONTS,
  checkEncodable,
  mergePdfs,
  stampPdf,
  visibleSize,
  type FontName,
  type StampOptions,
} from "./stamp";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;
const STORAGE_KEY = "numerador-facturas:v1";

interface Entry {
  file: File;
  bytes: Uint8Array;
  pages: number;
  size: Size | null; // first page, as displayed
  error?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);

let entries: Entry[] = [];
let current = 0;

// ---------- settings ----------

const SETTINGS = [
  "template",
  "start",
  "end",
  "fromX",
  "xMm",
  "fromY",
  "yMm",
  "font",
  "sizePt",
  "color",
];
const CHECKS = ["background", "zip", "merge"];

for (const f of FONTS) select("font").add(new Option(f.replace(/-/g, " "), f));

function loadSettings(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      string | boolean
    >;
    for (const k of SETTINGS)
      if (typeof saved[k] === "string") ($(k) as HTMLInputElement).value = saved[k];
    for (const k of CHECKS) if (typeof saved[k] === "boolean") input(k).checked = saved[k];
  } catch {
    // ponytail: corrupt or blocked storage just means defaults
  }
}

function saveSettings(): void {
  const data: Record<string, string | boolean> = {};
  for (const k of SETTINGS) data[k] = ($(k) as HTMLInputElement).value;
  for (const k of CHECKS) data[k] = input(k).checked;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

loadSettings();

function stampOptions(): StampOptions {
  return {
    fromX: select("fromX").value as FromX,
    xMm: Number(input("xMm").value) || 0,
    fromY: select("fromY").value as FromY,
    yMm: Number(input("yMm").value) || 0,
    font: select("font").value as FontName,
    sizePt: Number(input("sizePt").value) || 11,
    color: input("color").value,
    background: input("background").checked,
  };
}

const optionalNumber = (id: string) =>
  input(id).value === "" ? undefined : Number(input(id).value);
const valid = () => entries.filter((e) => !e.error);

/** Number text per valid entry, or an error message. */
async function numbering(): Promise<{ numbers: Map<Entry, string> } | { error: string }> {
  try {
    const ok = valid();
    const { start } = resolveRange(
      Math.max(ok.length, 1),
      optionalNumber("start"),
      optionalNumber("end"),
    );
    const tpl = input("template").value;
    const numbers = new Map(ok.map((e, i) => [e, formatNumber(tpl, start + i)]));
    await checkEncodable(formatNumber(tpl, start), stampOptions().font);
    return { numbers };
  } catch (e) {
    const msg = (e as Error).message;
    return {
      error: msg.includes("WinAnsi") ? "La fuente no admite algún carácter del formato" : msg,
    };
  }
}

// ---------- file list ----------

async function readEntry(file: File): Promise<Entry> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const doc = await PDFDocument.load(bytes);
    return { file, bytes, pages: doc.getPageCount(), size: visibleSize(doc.getPage(0)) };
  } catch (e) {
    const encrypted = /encrypt/i.test((e as Error).message);
    return {
      file,
      bytes,
      pages: 0,
      size: null,
      error: encrypted ? "PDF protegido" : "No es un PDF válido",
    };
  }
}

async function addFiles(files: FileList | File[]): Promise<void> {
  const pdfs = [...files].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  setStatus(`Leyendo ${pdfs.length} archivo(s)…`);
  const added = await Promise.all(pdfs.map(readEntry));
  entries = sortEntries([...entries, ...added]);
  setStatus("");
  refresh();
}

function sortEntries(list: Entry[]): Entry[] {
  const byFile = new Map(list.map((e) => [e.file, e]));
  return sortFiles([...byFile.keys()], select("sortBy").value as "name" | "date").map((f) =>
    byFile.get(f)!,
  );
}

const sizeLabel = (s: Size | null) => {
  if (!s) return "";
  const w = Math.round(s.width);
  const h = Math.round(s.height);
  return w === 210 && h === 297 ? "A4" : `${w}×${h} mm`;
};

function move(from: number, to: number): void {
  if (to < 0 || to >= entries.length) return;
  const [e] = entries.splice(from, 1);
  entries.splice(to, 0, e);
  if (current === from) current = to;
  refresh();
}

async function renderList(): Promise<void> {
  const list = $<HTMLOListElement>("list");
  const result = await numbering();
  const numbers = "numbers" in result ? result.numbers : new Map<Entry, string>();
  list.replaceChildren(
    ...entries.map((e, i) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.className = (e.error ? "error " : "") + (i === current ? "current" : "");
      li.innerHTML = `
        <span class="num"></span>
        <button type="button" class="name link"></button>
        <span class="meta"></span>
        <span class="actions">
          <button type="button" data-act="up" aria-label="Subir">↑</button>
          <button type="button" data-act="down" aria-label="Bajar">↓</button>
          <button type="button" data-act="del" aria-label="Quitar">✕</button>
        </span>`;
      li.querySelector(".num")!.textContent = numbers.get(e) ?? "—";
      li.querySelector(".name")!.textContent = e.file.name;
      li.querySelector(".meta")!.textContent = e.error ?? `${e.pages} pág. · ${sizeLabel(e.size)}`;
      li.addEventListener("click", (ev) => {
        const act = (ev.target as HTMLElement).dataset.act;
        if (act === "up") move(i, i - 1);
        else if (act === "down") move(i, i + 1);
        else if (act === "del") {
          entries.splice(i, 1);
          current = Math.min(current, Math.max(entries.length - 1, 0));
          refresh();
        } else if ((ev.target as HTMLElement).closest(".name")) {
          current = i;
          refresh();
        }
      });
      li.addEventListener("dragstart", (ev) => ev.dataTransfer!.setData("text/plain", String(i)));
      li.addEventListener("dragover", (ev) => ev.preventDefault());
      li.addEventListener("drop", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const from = Number(ev.dataTransfer!.getData("text/plain"));
        if (!Number.isNaN(from)) move(from, i);
      });
      return li;
    }),
  );

  const ok = valid();
  const rangeEl = $("range");
  rangeEl.classList.toggle("bad", "error" in result);
  if ("error" in result) rangeEl.textContent = result.error;
  else if (ok.length)
    rangeEl.textContent = `${ok.length} factura(s): ${result.numbers.get(ok[0])} … ${result.numbers.get(ok[ok.length - 1])}`;
  else
    rangeEl.textContent = `Ejemplo: ${formatNumber(input("template").value, optionalNumber("start") ?? 1)}`;
  $<HTMLButtonElement>("run").disabled =
    "error" in result || ok.length === 0 || (!input("zip").checked && !input("merge").checked);
}

// ---------- preview ----------

let renderSeq = 0;

async function renderPreview(): Promise<void> {
  const seq = ++renderSeq;
  const canvas = $<HTMLCanvasElement>("canvas");
  const e = entries[current];
  $("previewName").textContent = e
    ? `${current + 1}/${entries.length} · ${e.file.name}`
    : "Sin archivos";
  if (!e || e.error) {
    canvas.width = canvas.height = 0;
    return;
  }
  const result = await numbering();
  const text = "numbers" in result ? result.numbers.get(e)! : "";
  const bytes = text ? await stampPdf(e.bytes, text, stampOptions()) : e.bytes;
  if (seq !== renderSeq) return;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    cMapUrl: `${ASSETS}cmaps/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const cssWidth = canvas.parentElement!.clientWidth;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * devicePixelRatio });
  const off = document.createElement("canvas");
  off.width = viewport.width;
  off.height = viewport.height;
  await page.render({ canvas: off, viewport }).promise;
  await task.destroy();
  if (seq !== renderSeq) return;
  canvas.width = off.width;
  canvas.height = off.height;
  canvas.style.width = `${cssWidth}px`;
  canvas.getContext("2d")!.drawImage(off, 0, 0);
}

$("canvas").addEventListener("click", (ev) => {
  const size = entries[current]?.size;
  if (!size) return;
  const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
  const point = {
    x: ((ev.clientX - rect.left) / rect.width) * size.width,
    y: ((ev.clientY - rect.top) / rect.height) * size.height,
  };
  const o = pointToOffsets(
    point,
    size,
    select("fromX").value as FromX,
    select("fromY").value as FromY,
  );
  input("xMm").value = String(o.xMm);
  input("yMm").value = String(o.yMm);
  refresh();
});

// Switching a reference edge keeps the number where it is on the page being previewed.
for (const id of ["fromX", "fromY"]) {
  let previous = select(id).value;
  select(id).addEventListener("change", () => {
    const size = entries[current]?.size;
    if (size) {
      const before = { ...stampOptions(), [id]: previous };
      const o = pointToOffsets(
        offsetsToPoint(before, size),
        size,
        select("fromX").value as FromX,
        select("fromY").value as FromY,
      );
      input("xMm").value = String(o.xMm);
      input("yMm").value = String(o.yMm);
    }
    previous = select(id).value;
    refresh();
  });
}

$("prev").addEventListener("click", () => {
  if (current > 0) current--;
  refresh();
});
$("next").addEventListener("click", () => {
  if (current < entries.length - 1) current++;
  refresh();
});

// ---------- output ----------

function download(data: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function setStatus(msg: string): void {
  $("status").textContent = msg;
}

$("run").addEventListener("click", async () => {
  const result = await numbering();
  if ("error" in result) return;
  const button = $<HTMLButtonElement>("run");
  button.disabled = true;
  try {
    const ok = valid();
    const opts = stampOptions();
    const stamped: { name: string; data: Uint8Array }[] = [];
    for (const [i, e] of ok.entries()) {
      setStatus(`Numerando ${i + 1}/${ok.length}…`);
      const number = result.numbers.get(e)!;
      stamped.push({
        name: outputName(number, e.file.name),
        data: await stampPdf(e.bytes, number, opts),
      });
    }
    const first = result.numbers.get(ok[0])!;
    const last = result.numbers.get(ok[ok.length - 1])!;
    const label = outputName(`${first}_a_${last}`, "").replace(/_$/, "");
    if (input("zip").checked)
      download(zipFiles(stamped), `facturas_${label}.zip`, "application/zip");
    if (input("merge").checked) {
      setStatus("Combinando…");
      download(
        await mergePdfs(stamped.map((s) => s.data)),
        `facturas_${label}.pdf`,
        "application/pdf",
      );
    }
    setStatus(`Hecho: ${ok.length} factura(s), ${first} … ${last}.`);
  } catch (e) {
    setStatus(`Error: ${(e as Error).message}`);
  } finally {
    button.disabled = false;
  }
});

// ---------- wiring ----------

let timer = 0;
function refresh(): void {
  saveSettings();
  void renderList();
  clearTimeout(timer);
  timer = window.setTimeout(() => void renderPreview(), 120);
}

input("files").addEventListener("change", () => {
  void addFiles(input("files").files ?? []);
  input("files").value = "";
});
const drop = $("drop");
drop.addEventListener("dragover", (ev) => {
  ev.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (ev) => {
  ev.preventDefault();
  drop.classList.remove("over");
  void addFiles(ev.dataTransfer?.files ?? []);
});
select("sortBy").addEventListener("change", () => {
  entries = sortEntries(entries);
  refresh();
});
$("clear").addEventListener("click", () => {
  entries = [];
  current = 0;
  refresh();
});
for (const id of [...SETTINGS.filter((k) => k !== "fromX" && k !== "fromY"), ...CHECKS])
  $(id).addEventListener("input", refresh);
window.addEventListener("resize", () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void renderPreview(), 200);
});

refresh();
