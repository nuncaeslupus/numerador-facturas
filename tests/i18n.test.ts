import { describe, expect, it } from "vitest";
import { NumberingError, resolveRange } from "../src/format";
import { I18N, pickLang } from "../src/i18n";

describe("i18n", () => {
  it("test_dictionaries_no_empty_strings", () => {
    for (const [lang, d] of Object.entries(I18N))
      for (const [k, v] of Object.entries(d))
        if (typeof v === "string") expect(v, `${lang}.${k}`).not.toBe("");
  });

  it("test_pickLang_matches_base_tag_else_english", () => {
    expect(pickLang(["fr-CA", "en"])).toBe("fr");
    expect(pickLang(["zh-Hans-CN"])).toBe("zh");
    expect(pickLang(["pt-BR", "de"])).toBe("de");
    expect(pickLang(["pt-BR"])).toBe("en");
  });

  it("test_numbering_error_translates_with_its_args", () => {
    const err = (() => {
      try {
        resolveRange(10, 4, 60);
      } catch (e) {
        return e as NumberingError;
      }
    })()!;
    expect(err.key).toBe("errMismatch");
    expect(I18N.en[err.key](...(err.args as [number, number, number, number]))).toBe(
      "4 to 60 is 57 numbers, but there are 10 files",
    );
  });
});
