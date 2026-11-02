import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resetAppClient } from "../src/app/instance";
import { getCatalog } from "../src/domain/catalog";
import { fetchChapter } from "../src/domain/content";
import { clearDetailCache, getNovelDetail } from "../src/domain/detail";

/**
 * 模拟“网页端 404（版权受限 / 已下架）+ App 中继可用”的场景，
 * 验证详情、目录、正文都会自动回退到 App 中继。
 */
const META_XML = `<?xml version="1.0" encoding="utf-8"?>
<metadata>
<data name="Title"><![CDATA[受限测试小说]]></data>
<data name="Author" value="作者甲"/>
<data name="BookLength" value="12345"/>
<data name="LastUpdate" value="2024-01-01"/>
<data name="LatestSection"><![CDATA[第一章]]></data>
</metadata>`;

const INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<metadata>
<data name="Title"><![CDATA[受限测试小说]]></data>
<data name="Author" value="作者甲"/>
<data name="BookStatus" value="已完成"/>
<data name="Tags" value="测试 受限"/>
</metadata>`;

const LIST_XML = `<?xml version="1.0" encoding="utf-8"?>
<package>
<volume vid="100"><![CDATA[第一卷]]>
<chapter cid="101"><![CDATA[第一章]]></chapter>
<chapter cid="102"><![CDATA[插图]]></chapter>
</volume>
</package>`;

const CHAPTER_TEXT = "\n\n 第一卷 第一章 \n\n \n  \n 这是受限小说的正文内容。\n\n 第二段。";

const originalFetch = globalThis.fetch;

function xmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
}

function handleRelay(body: string): Response {
  const payload = new URLSearchParams(body.replace(/^&/, ""));
  const encoded = payload.get("request") ?? "";
  const params = Buffer.from(encoded, "base64").toString("utf8");

  if (params.includes("do=meta")) return xmlResponse(META_XML);
  if (params.includes("do=bookinfo")) return xmlResponse(INFO_XML);
  if (params.includes("do=intro")) return new Response("简介文本", { status: 200 });
  if (params.includes("do=list")) return xmlResponse(LIST_XML);
  if (params.includes("do=text")) return new Response(CHAPTER_TEXT, { status: 200 });

  return new Response("Bad request.", { status: 400 });
}

beforeAll(() => {
  clearDetailCache();
  resetAppClient();

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("wenku8-relay.mewx.org")) {
      return handleRelay(typeof init?.body === "string" ? init.body : "");
    }
    if (url.includes("www.wenku8.net")) {
      return new Response("Not Found", { status: 404 });
    }

    throw new Error(`未预期的请求：${url}`);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  clearDetailCache();
  resetAppClient();
});

describe("版权受限小说走 App 中继", () => {
  test("网页 404 时详情自动回退", async () => {
    const detail = await getNovelDetail(777001);

    expect(detail).not.toBeNull();
    expect(detail?.source).toBe("app");
    expect(detail?.restricted).toBe(true);
    expect(detail?.name).toBe("受限测试小说");
    expect(detail?.author).toBe("作者甲");
    expect(detail?.wordCount).toBe("12345");
    expect(detail?.tags).toBe("测试 受限");
    expect(detail?.brief).toBe("简介文本");
  });

  test("目录来自中继且解析正确", async () => {
    const detail = await getNovelDetail(777001);
    const catalog = await getCatalog(detail!);

    expect(catalog.source).toBe("app");
    expect(catalog.volumes).toHaveLength(1);
    expect(catalog.volumes[0]?.id).toBe("100");
    expect(catalog.volumes[0]?.chapters.map((chapter) => chapter.id)).toEqual(["101", "102"]);
  });

  test("正文获取并转换", async () => {
    const detail = await getNovelDetail(777001);
    const catalog = await getCatalog(detail!);
    const chapter = catalog.volumes[0]?.chapters[0];
    const content = await fetchChapter(catalog, chapter!);

    expect(content.text).toContain("这是受限小说的正文内容。");
    expect(content.text).not.toContain("第一卷");
    expect(content.html).toContain("<p>这是受限小说的正文内容。</p>");
  });
});
