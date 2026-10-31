import {
  EncryptedPDFError,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRawStream,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
} from "@cantoo/pdf-lib";
import { PT_PER_MM, offsetsToPoint, type Offsets, type Size } from "./position";

export type FontName = `${StandardFonts}`;
export const FONTS = Object.values(StandardFonts).filter(
  (f) => f !== "Symbol" && f !== "ZapfDingbats",
);

export interface StampOptions extends Offsets {
  font: FontName;
  sizePt: number;
  color: string; // #rrggbb
  background: boolean;
  boxColor: string; // #rrggbb
  boxPadMm: number; // margin between the number and the box edge
}

/**
 * Opens a PDF, decrypting it when it is encrypted. Owner-only protection (opens without a
 * password) needs nothing; otherwise pass the user password. Decrypted files come back
 * re-saved without encryption, so later steps can load them plainly.
 */
export async function openPdf(
  bytes: Uint8Array,
  password = "",
): Promise<{ doc: PDFDocument; bytes: Uint8Array }> {
  try {
    return { doc: await PDFDocument.load(bytes), bytes };
  } catch (e) {
    if (!(e instanceof EncryptedPDFError)) throw e;
  }
  const doc = await PDFDocument.load(bytes, { password, ignoreEncryption: true });
  // Saving the decrypted doc can keep /Encrypt in the trailer; a fresh doc cannot.
  // ponytail: copyPages drops outlines and forms — fine for invoices.
  const plain = await PDFDocument.create();
  for (const page of await plain.copyPages(doc, doc.getPageIndices())) plain.addPage(page);
  const out = await plain.save();
  return { doc: await PDFDocument.load(out), bytes: out };
}

/** True when openPdf failed for want of the right password. */
export const needsPassword = (e: unknown): boolean => /password/i.test((e as Error).message);

/** Size of the page as displayed (CropBox, rotation applied), in mm. */
export function visibleSize(page: PDFPage): Size {
  const { width, height } = page.getCropBox();
  const turned = page.getRotation().angle % 180 !== 0;
  return {
    width: (turned ? height : width) / PT_PER_MM,
    height: (turned ? width : height) / PT_PER_MM,
  };
}

/** Maps a point in displayed-page points (origin top-left, y down) to PDF user space. */
function toUser(page: PDFPage, vx: number, vy: number): { x: number; y: number } {
  const { x: x0, y: y0, width: w, height: h } = page.getCropBox();
  switch (((page.getRotation().angle % 360) + 360) % 360) {
    case 90:
      return { x: x0 + vy, y: y0 + vx };
    case 180:
      return { x: x0 + w - vx, y: y0 + vy };
    case 270:
      return { x: x0 + w - vy, y: y0 + h - vx };
    default:
      return { x: x0 + vx, y: y0 + h - vy };
  }
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function stampPage(page: PDFPage, text: string, font: PDFFont, o: StampOptions): void {
  const size = visibleSize(page);
  const p = offsetsToPoint(o, size);
  const tw = font.widthOfTextAtSize(text, o.sizePt);
  const ascent = font.heightAtSize(o.sizePt, { descender: false });
  const th = font.heightAtSize(o.sizePt);
  // The text box grows inward from the reference edges.
  const left = p.x * PT_PER_MM - (o.fromX === "right" ? tw : 0);
  const top = p.y * PT_PER_MM - (o.fromY === "bottom" ? th : 0);
  const rotate = degrees(page.getRotation().angle);

  if (o.background) {
    const pad = o.boxPadMm * PT_PER_MM;
    const corner = toUser(page, left - pad, top + th + pad);
    page.drawRectangle({
      ...corner,
      width: tw + 2 * pad,
      height: th + 2 * pad,
      color: hexToRgb(o.boxColor),
      rotate,
    });
  }
  page.drawText(text, {
    ...toUser(page, left, top + ascent),
    size: o.sizePt,
    font,
    color: hexToRgb(o.color),
    rotate,
  });
}

/**
 * Some producers (e.g. iSEDQuickPDF) emit an empty content stream marked `/Filter
 * /FlateDecode` with zero bytes — invalid, as Flate data needs at least a header. Left
 * first in `/Contents`, strict viewers (poppler, Chrome, Acrobat) tolerate it; but
 * stamping prepends a graphics-state wrapper, pushing it mid-array where the failed
 * inflate makes them abort the whole page (blank). Dropping the bogus filter from empty
 * streams — what qpdf does — makes `/Length 0` valid again. Lenient viewers (mupdf) were
 * never affected, which is why the page looked fine in some tools.
 */
function fixEmptyContentStreams(page: PDFPage): void {
  const { context } = page.node;
  const contents = page.node.Contents();
  const streams =
    contents instanceof PDFArray ? contents.asArray().map((r) => context.lookup(r)) : [contents];
  for (const s of streams) {
    if (s instanceof PDFRawStream && s.contents.length === 0) s.dict.delete(PDFName.of("Filter"));
  }
}

/** Stamps `text` on every page. Expects bytes from openPdf; throws on unreadable PDFs. */
export async function stampPdf(
  bytes: Uint8Array,
  text: string,
  o: StampOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(o.font);
  for (const page of doc.getPages()) {
    fixEmptyContentStreams(page);
    stampPage(page, text, font, o);
  }
  return doc.save();
}

export async function mergePdfs(docs: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of docs) {
    const src = await PDFDocument.load(bytes);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
  }
  return out.save();
}

/**
 * Throws if a standard font cannot encode the text (e.g. characters outside WinAnsi).
 * encodeText cannot tell: it silently turns those characters into "?".
 */
export async function checkEncodable(text: string, fontName: FontName): Promise<void> {
  const doc = await PDFDocument.create();
  const known = new Set((await doc.embedFont(fontName)).getCharacterSet());
  const bad = [...text].filter((c) => !known.has(c.codePointAt(0) as number));
  if (bad.length) throw new Error(`Fuera de WinAnsi: ${[...new Set(bad)].join(" ")}`);
}
