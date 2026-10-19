import { zipSync } from "fflate";

/** outputName("F/0001", "a.pdf") → "F-0001_a.pdf" */
export function outputName(number: string, original: string): string {
  return `${number.replace(/[/\\:*?"<>|]/g, "-")}_${original}`;
}

/** PDFs are already compressed, so store without deflate. */
export function zipFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
  return zipSync(Object.fromEntries(files.map((f) => [f.name, [f.data, { level: 0 }]])));
}
