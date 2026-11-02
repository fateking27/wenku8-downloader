import { describe, expect, test } from "bun:test";
import { collapseBlankLines, decodeText, gbkUrlEncode, mergeCookies } from "../src/util/text";

describe("文本工具", () => {
  test("GBK URL 编码", () => {
    expect(gbkUrlEncode("剑")).toBe("%BD%A3");
    expect(gbkUrlEncode("abc-1")).toBe("abc-1");
  });

  test("UTF-16LE BOM（packtxt 格式）", () => {
    const buffer = new Uint8Array([0xff, 0xfe, 0xe5, 0x77]);
    expect(decodeText(buffer)).toBe("知");
  });

  test("UTF-8 与 GBK 自动识别", () => {
    const utf8 = new TextEncoder().encode("轻小说文库");
    expect(decodeText(utf8)).toBe("轻小说文库");

    // GBK 编码的 “轻小说”
    const gbk = new Uint8Array([0xc7, 0xe1, 0xd0, 0xa1, 0xcb, 0xb5]);
    expect(decodeText(gbk)).toBe("轻小说");
  });

  test("合并 Set-Cookie", () => {
    const merged = mergeCookies(["PHPSESSID=abc; path=/", "jieqiUserId=1; path=/", "PHPSESSID=deleted"]);
    expect(merged).toBe("jieqiUserId=1");
  });

  test("折叠多余空行", () => {
    expect(collapseBlankLines("a\n\n\n\nb\n")).toBe("a\n\nb");
  });
});
