import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { outputName, zipFiles } from "../src/output";

it("replaces path separators in the number", () => {
  expect(outputName("F/0001", "a.pdf")).toBe("F-0001_a.pdf");
});

it("zips files that unzip back to the same bytes", () => {
  const data = new Uint8Array([1, 2, 3]);
  expect(unzipSync(zipFiles([{ name: "x.pdf", data }]))["x.pdf"]).toEqual(data);
});
