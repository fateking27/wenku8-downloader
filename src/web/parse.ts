import { load } from "cheerio";
import { WEB_BASE } from "../config";
import type { ChapterRef, NovelDetail, NovelSummary, RankingKind, VolumeRef } from "../types";

/** 把相对 / 协议相对地址补全成绝对地址。 */
export function absoluteUrl(source: string | undefined, base = WEB_BASE): string {
  if (!source) return "";
  const trimmed = source.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("data:")) return trimmed;

  try {
    return new URL(trimmed, base).href;
  } catch {
    return trimmed;
  }
}

/** 取 “标签：xxx” 冒号后的内容。 */
function labeledValue(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const separator = normalized.search(/[：:]/);
  return separator >= 0 ? normalized.slice(separator + 1).trim() : normalized;
}

/** 从 /book/123.htm 或 /novel/0/123/456.htm 中提取小说 ID。 */
export function extractNovelId(href: string): string {
  const bookMatch = href.match(/\/book\/(\d+)\.htm/i);
  if (bookMatch?.[1]) return bookMatch[1];

  const novelMatch = href.match(/\/novel\/\d+\/(\d+)\//i);
  if (novelMatch?.[1]) return novelMatch[1];

  const segments = href.split("/").filter((segment) => segment.length > 0);
  const last = segments.at(-1) ?? "";
  return last.split(".")[0] ?? "";
}

export interface CatalogPage {
  title: string;
  author: string;
  volumes: VolumeRef[];
}

export function parseCatalogPage(html: string): CatalogPage | null {
  const $ = load(html);
  const volumes: VolumeRef[] = [];
  const looseChapters: ChapterRef[] = [];

  let current: VolumeRef | null = null;

  $("td").each((_, element) => {
    const cell = $(element);
    const className = cell.attr("class") ?? "";

    if (className.includes("vcss")) {
      const vid = cell.attr("vid") ?? "";
      current = {
        id: vid || String(volumes.length + 1),
        name: cell.text().trim() || `第${volumes.length + 1}卷`,
        chapters: [],
      };
      volumes.push(current);
      return;
    }

    if (!className.includes("ccss")) return;

    const anchor = cell.find("a").first();
    const href = anchor.attr("href") ?? "";
    if (!href) return;

    const file = href.split("/").pop() ?? href;
    const id = file.split(".")[0] ?? "";
    if (!id) return;

    const chapter: ChapterRef = { id, title: anchor.text().trim() || cell.text().trim() };
    if (current) current.chapters.push(chapter);
    else looseChapters.push(chapter);
  });

  if (looseChapters.length > 0) {
    volumes.unshift({ id: "0", name: "正文", chapters: looseChapters });
  }

  const usable = volumes.filter((volume) => volume.chapters.length > 0);
  if (usable.length === 0) return null;

  return {
    title: $("#title").text().trim(),
    author: labeledValue($("#info").text()),
    volumes: usable,
  };
}

/** 解析小说详情页。 */
export function parseDetailPage(html: string, novelId: string): NovelDetail | null {
  const $ = load(html);
  const content = $("#content").first();
  if (content.length === 0) return null;

  // 详情区第一层 <div> 下有两张直接子表：信息表 + 封面/标签表。
  // 注意不能用 find("table")：信息表内部还嵌套了一张标题表，索引会错位。
  const detailBlock = content.children("div").first();
  const tables = detailBlock.length > 0 ? detailBlock.children("table") : content.find("table");

  const firstTable = tables.eq(0);
  if (firstTable.length === 0) return null;

  const name = firstTable.find("span>b").text().trim() || firstTable.find("b").first().text().trim();
  if (!name) return null;

  // 信息行：文库分类 / 小说作者 / 文章状态 / 最后更新 / 全文长度
  const infoTexts = firstTable
    .find("tr")
    .last()
    .find("td")
    .map((_, element) => $(element).text().trim())
    .get();

  const info = (labels: readonly string[], fallbackIndex: number): string => {
    const hit = infoTexts.find((text) => labels.some((label) => text.startsWith(label)));
    return hit ? labeledValue(hit) : labeledValue(infoTexts[fallbackIndex] ?? "");
  };

  // 第二张表包含封面与标签/最新章节/简介。若模板变化，兜底找含 span 的表格。
  let metaTable = tables.eq(1);
  if (metaTable.length === 0 || metaTable.find("span").length === 0) {
    const found = content.find("table").filter((_, element) => $(element).find("span").length > 0).first();
    if (found.length > 0) metaTable = found;
  }

  const coverSrc = metaTable.find("img").first().attr("src");

  const readMultiline = (element: Parameters<typeof $>[0]): string => {
    const html = $(element).html() ?? "";

    if (!/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/i.test(html)) {
      return $(element).text().replace(/\r\n?/g, "\n").trim();
    }

    const broken = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n");
    const text = load(`<div id="__multiline__">${broken}</div>`)("#__multiline__").text();

    return text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  };

  const spans = metaTable
    .find("span")
    .map((_, element) => ({
      normalized: $(element).text().replace(/\s+/g, " ").trim(),
      multiline: readMultiline(element),
    }))
    .get();

  const spanValue = (labels: readonly string[], preserveNewlines = false): string => {
    for (let index = 0; index < spans.length; index += 1) {
      const span = spans[index];
      if (!span || !labels.some((label) => span.normalized.startsWith(label))) continue;

      const inline = labeledValue(span.normalized);
      if (inline) {
        if (!preserveNewlines) return inline;

        const separator = span.multiline.search(/[：:]/);
        return (separator >= 0 ? span.multiline.slice(separator + 1) : span.multiline).trim();
      }

      for (let next = index + 1; next < spans.length; next += 1) {
        const value = spans[next];
        if (!value) continue;
        const text = preserveNewlines ? value.multiline : value.normalized;
        if (text) return text;
      }
    }
    return "";
  };

  const tags = spanValue(["作品Tags", "作品标签", "标签"]);
  const latestChapter = spanValue(["最近章节", "最新章节"]);
  const brief =
    spanValue(["内容简介", "作品简介", "简介"], true) ||
    ([...spans].reverse().find((span) => span.multiline.length > 60)?.multiline ?? "");

  return {
    id: novelId,
    name,
    author: info(["小说作者", "作者"], 1),
    tags,
    status: info(["文章状态", "状态"], 2),
    updateTime: info(["最后更新", "更新时间"], 3),
    wordCount: info(["全文长度", "字数"], 4),
    latestChapter,
    brief,
    cover: absoluteUrl(coverSrc),
    source: "web",
    restricted: false,
  };
}

/** 搜索页：单本直接跳转详情页，多本返回列表。 */
export function parseSearchPage(html: string, finalUrl: string, keyword: string): NovelSummary[] {
  const $ = load(html);

  const isSingleBook = $("#centerm>#content>.grid>caption").length === 0;
  if (isSingleBook) {
    const id = extractNovelId(finalUrl) || (/^\d+$/.test(keyword) ? keyword : "");
    if (!id) return [];
    const detail = parseDetailPage(html, id);
    if (!detail) return [];
    return [
      {
        id: detail.id,
        name: detail.name,
        author: detail.author,
        tags: detail.tags,
        cover: detail.cover,
        brief: detail.brief,
      },
    ];
  }

  const items = $("#centerm>#content")
    .find(".grid td>div")
    .map((_, element) => {
      const item = $(element);
      const href = item.find("a").first().attr("href") ?? "";
      const id = extractNovelId(href);
      const name = item.find("b").first().text().trim();
      const paragraphs = item.find("p");

      return {
        id,
        name,
        author: labeledValue(paragraphs.eq(0).text().trim()),
        tags: paragraphs
          .eq(2)
          .find("span")
          .text()
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .join(" "),
        cover: absoluteUrl(item.find("img").first().attr("src")),
        brief: paragraphs.eq(3).text().trim(),
      } satisfies NovelSummary;
    })
    .get();

  return items.filter((item) => item.id.length > 0 && item.name.length > 0);
}

/** 首页榜单解析。 */
export function parseRankingPage(html: string, kind: RankingKind): NovelSummary[] {
  const $ = load(html);
  const results: NovelSummary[] = [];

  if (kind === "hot") {
    $("#right .block")
      .eq(0)
      .find(".blockcontent li")
      .each((_, element) => {
        const anchor = $(element).find("a").first();
        const id = extractNovelId(anchor.attr("href") ?? "");
        if (!id) return;
        results.push({ id, name: anchor.attr("title")?.trim() || anchor.text().trim(), author: "" });
      });
  } else if (kind === "new") {
    $("#centers .block")
      .eq(2)
      .find(".blockcontent a")
      .each((_, element) => {
        const anchor = $(element);
        const id = extractNovelId(anchor.attr("href") ?? "");
        if (!id) return;
        results.push({ id, name: anchor.attr("title")?.trim() || anchor.text().trim(), author: "" });
      });
  } else {
    $("#centers .block")
      .eq(4)
      .find(".blockcontent .lm")
      .each((_, element) => {
        const row = $(element);
        const id = extractNovelId(row.find(".poptext").attr("href") ?? "");
        if (!id) return;
        results.push({
          id,
          name: row.text().trim(),
          author: "",
          extra: row.next().text().trim(),
        });
      });
  }

  const seen = new Set<string>();
  return results.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** 清洗章节正文 HTML，去掉广告与脚本。 */
export function cleanChapterHtml(html: string): string | null {
  const $ = load(html);
  const main = $("#contentmain").first();
  if (main.length === 0) return null;

  main.find("script, style, iframe, #adv300, #adv900, #contentdp, .ad").remove();
  const cleaned = main.html();
  return cleaned && cleaned.trim() ? cleaned : null;
}

/** 提取 HTML 中的图片地址。 */
export function extractImageUrls(html: string): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $("img").each((_, element) => {
    const src = $(element).attr("src");
    const resolved = absoluteUrl(src);
    if (resolved && !resolved.startsWith("data:")) urls.add(resolved);
  });

  return [...urls];
}
