import iconv from "iconv-lite";

/** 把 GBK 页面内容解码成 UTF-8 字符串。 */
export function decodeGbk(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  return iconv.decode(Buffer.from(bytes), "gbk");
}

/** 自动识别 BOM / UTF-8 / GBK（packtxt 使用 UTF-16LE）。 */
export function decodeText(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    } catch {
      return decodeGbk(bytes);
    }
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return decodeGbk(bytes);
  }
}

/**
 * 按 GBK 编码做 URL 百分号编码（wenku8 搜索接口要求 GBK 参数）。
 */
export function gbkUrlEncode(text: string): string {
  const bytes = iconv.encode(text, "gbk");
  let encoded = "";

  for (const byte of bytes) {
    const isUnreserved =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      byte === 0x2d ||
      byte === 0x2e ||
      byte === 0x5f ||
      byte === 0x7e;

    encoded += isUnreserved
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }

  return encoded;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function collapseBlankLines(text: string): string {
  return normalizeNewlines(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isHtmlDocument(text: string): boolean {
  return /^\s*(?:<!doctype|<html|<head|<body)/i.test(text);
}

export interface SetCookieHeaders {
  getSetCookie?: () => string[];
  get: (name: string) => string | null;
}

/** 读取所有 Set-Cookie（兼容只提供 get("set-cookie") 的实现）。 */
export function getSetCookies(headers: SetCookieHeaders): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];

  // 逗号分隔的 Cookie 中，过期时间是 GMT 日期，不能简单按逗号切分。
  return raw.split(/,(?=\s*[^;,=]+=[^;,]*)/).map((item) => item.trim());
}

/** 从 Set-Cookie 中取出某个 Cookie 的值。 */
export function cookieValue(setCookies: readonly string[], name: string): string | null {
  for (const cookie of setCookies) {
    const first = cookie.split(";")[0]?.trim() ?? "";
    if (first.startsWith(`${name}=`)) {
      const value = first.slice(name.length + 1);
      if (value && value !== "deleted") return value;
    }
  }
  return null;
}

/** 把多条 Set-Cookie 合并成请求用的 Cookie 头。 */
export function mergeCookies(setCookies: readonly string[]): string {
  const pairs = new Map<string, string>();

  for (const cookie of setCookies) {
    const first = cookie.split(";")[0]?.trim() ?? "";
    const separator = first.indexOf("=");
    if (separator <= 0) continue;
    const name = first.slice(0, separator);
    const value = first.slice(separator + 1);
    if (!value || value === "deleted") pairs.delete(name);
    else pairs.set(name, value);
  }

  return [...pairs.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}
