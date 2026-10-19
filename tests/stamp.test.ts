import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { PT_PER_MM } from "../src/position";
import { mergePdfs, stampPdf, type StampOptions } from "../src/stamp";

const MM = PT_PER_MM;
const OPTS: StampOptions = {
  fromX: "right",
  xMm: 10,
  fromY: "top",
  yMm: 10,
  font: "Helvetica",
  sizePt: 10,
  color: "#000000",
  background: false,
};

async function makePdf(pages: [number, number][], rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of pages) doc.addPage(size).setRotation(degrees(rotation));
  return doc.save();
}

/** Text items per page, positioned in displayed-page points (origin top-left). */
async function readText(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const items = (await page.getTextContent()).items.flatMap((it) =>
      "str" in it && it.str
        ? [{ str: it.str, at: vp.convertToViewportPoint(it.transform[4], it.transform[5]) }]
        : [],
    );
    pages.push(items);
  }
  return pages;
}

/** Where the baseline-left of `text` should land for OPTS on a page `widthMm` wide. */
async function expectedBaseline(text: string, widthMm: number) {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  return [
    (widthMm - 10) * MM - font.widthOfTextAtSize(text, 10),
    10 * MM + font.heightAtSize(10, { descender: false }),
  ];
}

describe("stampPdf", () => {
  it("test_stampPdf_three_pages_number_on_all", async () => {
    const a4: [number, number] = [210 * MM, 297 * MM];
    const out = await stampPdf(await makePdf([a4, a4, a4]), "F-0001", OPTS);
    const pages = await readText(out);
    expect(pages).toHaveLength(3);
    for (const items of pages) expect(items.map((i) => i.str)).toEqual(["F-0001"]);
  });

  it("test_stampPdf_receipt_size_top_right_keeps_margin", async () => {
    const out = await stampPdf(await makePdf([[210 * MM, 99 * MM]]), "F-0001", OPTS);
    const [[item]] = await readText(out);
    const [x, y] = await expectedBaseline("F-0001", 210);
    expect(item.at[0]).toBeCloseTo(x, 1);
    expect(item.at[1]).toBeCloseTo(y, 1);
  });

  it("test_stampPdf_rotated_page_places_text_visually", async () => {
    // A landscape-displayed page stored portrait with /Rotate 90: displayed width is 297 mm.
    for (const rot of [90, 180, 270]) {
      const stored: [number, number] = rot === 180 ? [297 * MM, 210 * MM] : [210 * MM, 297 * MM];
      const out = await stampPdf(await makePdf([stored], rot), "F-0001", OPTS);
      const [[item]] = await readText(out);
      const [x, y] = await expectedBaseline("F-0001", 297);
      expect(item.at[0], `rotate ${rot}`).toBeCloseTo(x, 1);
      expect(item.at[1], `rotate ${rot}`).toBeCloseTo(y, 1);
    }
  });

  it("test_stampPdf_background_draws_white_rect", async () => {
    const page = [[210 * MM, 297 * MM]] as [number, number][];
    const fills = async (background: boolean) => {
      const out = await stampPdf(await makePdf(page), "F-0001", { ...OPTS, background });
      const ops = await (
        await (await getDocument({ data: out }).promise).getPage(1)
      ).getOperatorList();
      return ops.fnArray.flatMap((fn, i) =>
        fn === OPS.setFillRGBColor ? [ops.argsArray[i][0]] : [],
      );
    };
    expect(await fills(true)).toEqual(["#ffffff", "#000000"]);
    expect(await fills(false)).toEqual(["#000000"]);
  });

  it("rejects a corrupt file", async () => {
    await expect(stampPdf(new Uint8Array([1, 2, 3]), "x", OPTS)).rejects.toThrow();
  });
});

it("mergePdfs keeps every page in order", async () => {
  const a = await stampPdf(await makePdf([[595, 842]]), "A", OPTS);
  const b = await stampPdf(
    await makePdf([
      [595, 842],
      [595, 842],
    ]),
    "B",
    OPTS,
  );
  const pages = await readText(await mergePdfs([a, b]));
  expect(pages.map((p) => p[0].str)).toEqual(["A", "B", "B"]);
});
