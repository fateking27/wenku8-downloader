import { describe, expect, test } from "bun:test";
import { isPromoOnly } from "../src/export/txt";

describe("packtxt 结果校验", () => {
  test("参数错误时的宣传语会被识别为无效结果", () => {
    const promo =
      " ★☆★☆★☆轻小说文库(Www.WenKu8.com)☆★☆★☆★ \n\n " +
      "◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆ \n" +
      "更多精彩热门日本轻小说、动漫小说，轻小说文库(http://www.wenku8.com) 为你一网打尽！ ";
    expect(isPromoOnly(promo)).toBe(true);
  });

  test("正常的整卷文本不会被误判", () => {
    expect(isPromoOnly("正文内容。".repeat(500))).toBe(false);
  });

  test("空内容视为无效", () => {
    expect(isPromoOnly("   ")).toBe(true);
  });
});
