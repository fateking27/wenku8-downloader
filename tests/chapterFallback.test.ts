import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { resetAppClient } from "../src/app/instance";
import { SETTINGS } from "../src/config";
import { fetchChapter, resetChapterFallbackCache } from "../src/domain/content";
import type { Catalog } from "../src/types";

const originalFetch = globalThis.fetch;
const mutableSettings = SETTINGS as unknown as { webRetryDelayMs: number };
const originalRetryDelay = mutableSettings.webRetryDelayMs;

const CHAPTER_TEXT = "\n\n 第一卷 第一章 \n\n 备用正文第一段。\n\n 备用正文第二段。";

const catalog: Catalog = {
  source: "web",
  novelId: "770001",
  title: "正文回退测试",
  author: "test",
  volumes: [
    {
      id: "1",
      name: "第一卷",
      chapters: [
        { id: "101", title: "第一章" },
        { id: "102", title: "第二章" },
      ],
    },
  ],
};

let webCalls = 0;
let relayCalls = 0;
let webStatus = 404;

beforeAll(() => {
  mutableSettings.webRetryDelayMs = 0;
  resetAppClient();

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("www.wenku8.net")) {
      webCalls += 1;
      return new Response("unavailable", { status: webStatus });
    }
    if (url.includes("wenku8-relay.mewx.org")) {
      relayCalls += 1;
      return new Response(CHAPTER_TEXT, { status: 200 });
    }

    throw new Error(`未预期的请求：${url}`);
  }) as unknown as typeof fetch;
});

beforeEach(() => {
  resetChapterFallbackCache();
  webCalls = 0;
  relayCalls = 0;
  webStatus = 404;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  mutableSettings.webRetryDelayMs = originalRetryDelay;
  resetChapterFallbackCache();
  resetAppClient();
});

describe("正文失败后切换数据源", () => {
  test("网页连续 5 次失败后改用备用数据源", async () => {
    webStatus = 403;

    const content = await fetchChapter(catalog, catalog.volumes[0]!.chapters[0]!);

    expect(webCalls).toBe(5);
    expect(relayCalls).toBe(1);
    expect(content.text).toContain("备用正文第一段。");
    expect(content.text).not.toContain("第一卷 第一章");
  });

  test("切换成功后，后续章节直接走备用数据源", async () => {
    webStatus = 403;

    await fetchChapter(catalog, catalog.volumes[0]!.chapters[0]!);
    webCalls = 0;
    relayCalls = 0;

    const content = await fetchChapter(catalog, catalog.volumes[0]!.chapters[1]!);

    expect(webCalls).toBe(0);
    expect(relayCalls).toBe(1);
    expect(content.text).toContain("备用正文");
  });

  test("网页 404 时立即回退", async () => {
    webStatus = 404;

    const content = await fetchChapter(catalog, catalog.volumes[0]!.chapters[0]!);

    expect(webCalls).toBe(1);
    expect(relayCalls).toBe(1);
    expect(content.text).toContain("备用正文");
  });
});
