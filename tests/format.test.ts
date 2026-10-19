import { describe, expect, it } from "vitest";
import { formatNumber, parseTemplate, resolveRange } from "../src/format";

describe("formatNumber", () => {
  it("test_formatNumber_padded_template_returns_F0007", () => {
    expect(formatNumber("F-{n:4}", 7)).toBe("F-0007");
  });
  it("pads nothing with plain {n} and keeps prefix/suffix", () => {
    expect(formatNumber("2026/{n}-A", 12)).toBe("2026/12-A");
  });
  it("does not truncate numbers longer than the padding", () => {
    expect(formatNumber("{n:2}", 1234)).toBe("1234");
  });
  it("rejects templates without exactly one marker", () => {
    expect(() => parseTemplate("F-0001")).toThrow();
    expect(() => parseTemplate("{n}-{n}")).toThrow();
  });
});

describe("resolveRange", () => {
  it("test_resolveRange_end_only_computes_start", () => {
    expect(resolveRange(5, undefined, 28)).toEqual({ start: 24, end: 28 });
  });
  it("defaults to starting at 1", () => {
    expect(resolveRange(3)).toEqual({ start: 1, end: 3 });
  });
  it("counts forward from the start", () => {
    expect(resolveRange(57, 4)).toEqual({ start: 4, end: 60 });
  });
  it("accepts a matching start and end, rejects a mismatch", () => {
    expect(resolveRange(57, 4, 60)).toEqual({ start: 4, end: 60 });
    expect(() => resolveRange(10, 4, 60)).toThrow(/57 números/);
  });
  it("rejects an end that would start below zero", () => {
    expect(() => resolveRange(10, undefined, 3)).toThrow();
  });
});
