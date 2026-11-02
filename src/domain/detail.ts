import { coverUrl } from "../app/endpoints";
import { getAppClient } from "../app/instance";
import { SETTINGS } from "../config";
import { isLoginRequired, webGet, wenku8Login } from "../http/web";
import { errorMessage, warn } from "../log";
import type { NovelDetail } from "../types";
import { parseDetailPage } from "../web/parse";
import { webBookUrl } from "./urls";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  value: NovelDetail | null;
}

const cache = new Map<string, CacheEntry>();

function hasWebMeta(detail: NovelDetail): boolean {
  return Boolean(detail.wordCount || detail.latestChapter || detail.updateTime);
}

interface WebDetailResult {
  detail: NovelDetail | null;
  /** 页面明确返回 404：基本可以确定是下架 / 版权受限。 */
  notFound: boolean;
  /** 网络错误、Cloudflare 403 等临时不可用。 */
  unavailable: boolean;
}

async function loadWebDetail(id: string): Promise<WebDetailResult> {
  try {
    let page = await webGet(webBookUrl(id));

    if (page.status === 200 && isLoginRequired(page.html)) {
      const loggedIn = await wenku8Login();
      if (loggedIn) page = await webGet(webBookUrl(id));
    }

    if (page.status === 404) {
      return { detail: null, notFound: true, unavailable: false };
    }
    if (page.status !== 200) {
      warn(`小说详情页连续 ${SETTINGS.webAttempts} 次请求失败（HTTP ${page.status}）`);
      return { detail: null, notFound: false, unavailable: true };
    }

    return { detail: parseDetailPage(page.html, id), notFound: false, unavailable: false };
  } catch (error) {
    warn(`小说详情页获取失败：${errorMessage(error)}`);
    return { detail: null, notFound: false, unavailable: true };
  }
}

/**
 * 从备用数据源补全详情。
 * 版权受限 / 已下架小说在网页端没有字数、更新时间等信息，但备用数据源上仍然完整。
 */
async function loadAppDetail(id: string): Promise<NovelDetail | null> {
  const aid = Number(id);
  if (!Number.isFinite(aid) || aid <= 0) return null;

  const client = getAppClient();
  const [infoResult, metaResult, introResult] = await Promise.allSettled([
    client.info(aid),
    client.meta(aid),
    client.intro(aid),
  ]);

  if (infoResult.status === "rejected" && metaResult.status === "rejected") {
    return null;
  }

  const info = infoResult.status === "fulfilled" ? infoResult.value : {};
  const meta = metaResult.status === "fulfilled" ? metaResult.value : {};
  const intro = introResult.status === "fulfilled" ? introResult.value : "";
  const merged: Record<string, string> = { ...info, ...meta };

  const name = merged["Title"] ?? "";
  if (!name) return null;

  return {
    id,
    name,
    author: merged["Author"] ?? "",
    tags: merged["Tags"] ?? "",
    status: merged["BookStatus"] ?? "",
    updateTime: merged["LastUpdate"] ?? "",
    wordCount: merged["BookLength"] ?? "",
    latestChapter: merged["LatestSection"] ?? "",
    brief: intro || merged["IntroPreview"] || "",
    cover: coverUrl(aid),
    source: "app",
    restricted: true,
  };
}

async function resolveDetail(id: string): Promise<NovelDetail | null> {
  const webResult = await loadWebDetail(id);
  const web = webResult.detail;

  if (web && hasWebMeta(web)) return web;

  const app = await loadAppDetail(id);

  if (app) {
    // 只有「页面 404」或「页面存在但没有元数据」才算版权受限 / 已下架；
    // 单纯的 403 / 网络错误只切换数据源，避免误判。
    const restricted = webResult.notFound || web !== null;

    if (web) {
      return {
        ...app,
        name: web.name || app.name,
        author: web.author || app.author,
        tags: web.tags || app.tags,
        brief: web.brief || app.brief,
        cover: web.cover || app.cover,
        restricted,
      };
    }

    return {
      ...app,
      restricted,
    };
  }

  if (web) {
    return web;
  }

  warn(`未获取到小说详情：${id}`);
  return null;
}

/** 获取小说详情；网页优先，失败或缺少元数据时自动回退到备用数据源。 */
export async function getNovelDetail(novelId: string | number): Promise<NovelDetail | null> {
  const id = String(novelId).trim();
  if (!/^\d+$/.test(id)) {
    warn("小说 ID 必须为数字");
    return null;
  }

  const cached = cache.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const value = await resolveDetail(id);
  cache.set(id, { at: Date.now(), value });
  return value;
}

export function clearDetailCache(): void {
  cache.clear();
}
