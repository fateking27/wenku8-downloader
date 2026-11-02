import { describe, expect, test } from "bun:test";
import { magicAppver, magicDebug, resolveFlavor } from "../src/app/appver";

describe("appver 签名", () => {
  test("复刻抓包样本 1.25 / chibi-chapter", () => {
    // 抓包：appver=1.25-chibi-chapter-a8ba90fd&timetoken=1792842674994
    expect(magicAppver({ ver: "1.25", nowMs: 1792842674994 })).toBe("1.25-chibi-chapter-a8ba90fd");
  });

  test("同一分钟桶内结果稳定，跨分钟变化", () => {
    const first = magicAppver({ nowMs: 1792842674994 });
    const sameMinute = magicAppver({ nowMs: 1792842674994 + 30_000 });
    const nextMinute = magicAppver({ nowMs: 1792842674994 + 60_000 });

    expect(first).toBe(sameMinute);
    expect(first).not.toBe(nextMinute);
  });

  test("默认版本为 1.30 / digital-bento", () => {
    const debug = magicDebug({ nowMs: 1792842674994 });
    expect(debug.ver).toBe("1.30");
    expect(debug.flavor).toBe("digital-bento");
    expect(debug.appver).toMatch(/^1\.30-digital-bento-[0-9a-f]{8}$/);
  });

  test("未知版本会在缺少 flavor 时给出明确错误", () => {
    expect(() => resolveFlavor("9.99")).toThrow(/app\.flavor/);
    expect(resolveFlavor("9.99", "custom-flavor")).toBe("custom-flavor");
  });
});
