import { htmlToText } from "html-to-text";
import { getAppClient } from "../app/instance";
import { SETTINGS } from "../config";
import { isLoginRequired, webGet, wenku8Login } from "../http/web";
import type { Catalog, ChapterContent, ChapterRef } from "../types";
import { collapseBlankLines, normalizeNewlines } from "../util/text";
import { cleanChapterHtml, extractImageUrls } from "../web/parse";
import { webChapterUrl, webIndexUrl } from "./urls";

export class ChapterUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapterUnavailableError";
  }
}

const IMAGE_MARKER = /<!--\s*image\s*-->\s*([^<\s]+)\s*<!--\s*image\s*-->/gi;
const IMAGE_PLACEHOLDER = /\[\[IMAGE:(\d+)\]\]/g;

export interface AppChapterConversion {
  html: string;
  text: string;
  images: string[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * 判断首行是否为服务端自动加上的 “分卷名 章节名” 标题前缀。
 * 例如正文以 `第一卷 1、湿漉漉的老鼠` 开头时应当去掉。
 */
function isTitleLine(line: string, chapterTitle: string): boolean {
  const normalizedTitle = normalizeLine(chapterTitle);
  if (!normalizedTitle) return false;

  const normalizedLine = normalizeLine(line);
  if (normalizedLine === normalizedTitle) return true;
  if (!normalizedLine.endsWith(normalizedTitle)) return false;

  const prefix = normalizedLine.slice(0, normalizedLine.length - normalizedTitle.length);
  return prefix.length <= 40;
}

/**
 * 把备用数据源返回的章节文本转换成 HTML + 纯文本。
 *
 * 正文格式：标题前缀 + 以空行分隔的段落，插图以
 * `<!--image-->URL<!--image-->` 形式内嵌。
 */
export function convertAppChapterText(raw: string, chapterTitle: string): AppChapterConversion {
  const lines = normalizeNewlines(raw).split("\n");

  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex >= 0) {
    const firstLine = lines[firstContentIndex] ?? "";
    if (isTitleLine(firstLine, chapterTitle)) lines.splice(firstContentIndex, 1);
  }

  const images: string[] = [];
  let body = lines.join("\n");

  body = body.replace(IMAGE_MARKER, (_match, url: string) => {
    images.push(url.trim());
    return `\n[[IMAGE:${images.length - 1}]]\n`;
  });

  // 极少数章节会夹带 HTML 标签，统一转成换行 / 去标签，避免明文标签出现在正文里。
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "");

  const htmlParts: string[] = [];
  const textParts: string[] = [];

  for (const block of body.split(/\n[ \t]*\n/)) {
    const textLines: string[] = [];
    const blockImages: string[] = [];

    for (const line of block.split("\n")) {
      const stripped = line
        .replace(IMAGE_PLACEHOLDER, (_match, index: string) => {
          const url = images[Number(index)];
          if (url) blockImages.push(url);
          return "";
        })
        .trim();
      if (stripped) textLines.push(stripped);
    }

    if (textLines.length > 0) {
      htmlParts.push(`<p>${textLines.map(escapeHtml).join("<br/>")}</p>`);
      textParts.push(textLines.join("\n"));
    }

    for (const url of blockImages) {
      htmlParts.push(`<div class="divimage"><img src="${escapeAttribute(url)}" alt="" /></div>`);
    }
  }

  return {
    html: htmlParts.join("\n"),
    text: collapseBlankLines(textParts.join("\n\n")),
    images,
  };
}

const NOTICE_PATTERNS: readonly RegExp[] = [
  /版权(?:原因|限制|方|问题|保护)/,
  /已下架/,
  /(?:本书|该作品|该小说|此作品).{0,12}(?:下架|屏蔽|删除|无法(?:阅读|查看))/,
  /(?:仅|只)(?:对|限|供).{0,10}(?:会员|VIP)/i,
  /VIP(?:章节|专享)/i,
  /请(?:登录|前往).{0,12}(?:阅读|查看)/,
];

/**
 * 识别 “因版权原因无法提供内容” 之类的提示页。
 * 只在正文很短且没有插图时判断，避免误伤正常章节。
 */
export function detectRestrictedNotice(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 800) return null;

  for (const pattern of NOTICE_PATTERNS) {
    if (pattern.test(trimmed)) return trimmed.slice(0, 300);
  }
  return null;
}

async function fetchAppChapter(catalog: Catalog, chapter: ChapterRef): Promise<ChapterContent> {
  const aid = Number(catalog.novelId);
  const cid = Number(chapter.id);

  if (!Number.isFinite(aid) || !Number.isFinite(cid)) {
    throw new ChapterUnavailableError("无法定位章节编号");
  }

  const raw = await getAppClient().chapterText(aid, cid);
  const conversion = convertAppChapterText(raw, chapter.title);

  const notice = detectRestrictedNotice(conversion.text);
  if (notice && conversion.images.length === 0) {
    throw new ChapterUnavailableError(`章节受版权限制：${notice}`);
  }
  if (!conversion.html.trim() && conversion.images.length === 0) {
    throw new ChapterUnavailableError("章节内容为空");
  }

  return {
    title: chapter.title,
    html: conversion.html,
    text: conversion.text,
    images: conversion.images,
  };
}

function toPlainText(html: string): string {
  return collapseBlankLines(
    htmlToText(html, {
      wordwrap: false,
      ignoreHref: true,
      ignoreImage: true,
      selectors: [{ selector: "#contentdp", format: "skip" }],
    }),
  );
}

async function fetchWebChapter(catalog: Catalog, chapter: ChapterRef): Promise<ChapterContent> {
  const url = webChapterUrl(catalog.novelId, chapter.id);
  let page = await webGet(url, { referer: webIndexUrl(catalog.novelId) });

  // VIP / 登录可见章节会返回登录提示页，登录后重试一次。
  if (page.status === 200 && isLoginRequired(page.html)) {
    const loggedIn = await wenku8Login();
    if (loggedIn) {
      page = await webGet(url, { referer: webIndexUrl(catalog.novelId) });
    }
  }

  if (page.status === 404) {
    throw new ChapterUnavailableError("章节页面不存在（可能已下架）");
  }
  if (page.status !== 200) {
    throw new ChapterUnavailableError(
      `章节页面连续 ${SETTINGS.webAttempts} 次请求失败（HTTP ${page.status}）`,
    );
  }

  const html = cleanChapterHtml(page.html);
  if (!html) {
    const pageText = toPlainText(page.html);
    const notice = detectRestrictedNotice(pageText);
    throw new ChapterUnavailableError(notice ? `章节受版权限制：${notice}` : "未获取到章节正文");
  }

  const text = toPlainText(html);
  const images = extractImageUrls(html);

  if (!text && images.length === 0) {
    throw new ChapterUnavailableError("章节正文为空");
  }

  return { title: chapter.title, html, text, images };
}

/**
 * 已确认网页正文不可用的小说。
 * 首次在网页端连续失败 5 次并成功从备用数据源取到正文后记录，
 * 后续章节直接走备用数据源，避免每章都重复等待。
 */
const appOnlyNovels = new Set<string>();

/** 清理正文回退缓存（测试用）。 */
export function resetChapterFallbackCache(): void {
  appOnlyNovels.clear();
}

/** 按目录来源抓取章节内容（统一入口）。 */
export async function fetchChapter(catalog: Catalog, chapter: ChapterRef): Promise<ChapterContent> {
  if (catalog.source === "app" || appOnlyNovels.has(catalog.novelId)) {
    return fetchAppChapter(catalog, chapter);
  }

  try {
    return await fetchWebChapter(catalog, chapter);
  } catch (webError) {
    // webGet() 已经对同一章连续尝试了 5 次；仍失败则改走备用数据源。
    try {
      const content = await fetchAppChapter(catalog, chapter);
      appOnlyNovels.add(catalog.novelId);
      return content;
    } catch {
      throw webError;
    }
  }
}

/** 插图章节标题通常就叫 “插图”。 */
export function isIllustrationChapter(title: string): boolean {
  const normalized = title.trim();
  return normalized === "插图" || normalized === "插圖" || normalized.endsWith("插图") || normalized.endsWith("插圖");
}
