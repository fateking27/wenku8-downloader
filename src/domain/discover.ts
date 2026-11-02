import type { SortKey } from "../app/endpoints";
import { getAppClient } from "../app/instance";
import { WEB_BASE } from "../config";
import { isLoginRequired, searchUrl, webGet, wenku8Login } from "../http/web";
import { errorMessage } from "../log";
import type { NovelSummary, RankingKind } from "../types";
import { gbkUrlEncode } from "../util/text";
import { parseRankingPage, parseSearchPage } from "../web/parse";

/**
 * 网页不可用时的备用排序回退链。
 * 备用数据源对部分排序（如 dayvisit / lastupdate）偶尔返回空结果，因此准备备选排序。
 */
const RANKING_SORTS: Readonly<Record<RankingKind, readonly SortKey[]>> = {
  hot: ["dayvisit", "dayvote", "weekvisit"],
  new: ["postdate", "lastupdate"],
  updated: ["lastupdate", "postdate"],
};

async function searchByApp(keyword: string, type: "articlename" | "author"): Promise<NovelSummary[]> {
  try {
    return await getAppClient().search(keyword, type === "author" ? "author" : "title");
  } catch {
    return [];
  }
}

/**
 * 搜索小说。优先使用网页搜索（结果更完整），失败后回退到备用数据源。
 */
export async function searchNovels(keyword: string, type: "articlename" | "author"): Promise<NovelSummary[]> {
  const normalized = keyword.trim();
  if (!normalized) return [];

  const url = searchUrl(type, gbkUrlEncode(normalized));

  try {
    let page = await webGet(url);

    if (page.status === 200 && isLoginRequired(page.html)) {
      const loggedIn = await wenku8Login();
      if (loggedIn) page = await webGet(url);
    }

    if (page.status !== 200) throw new Error(`HTTP ${page.status}`);

    const results = parseSearchPage(page.html, page.url, normalized);
    if (results.length > 0) return results;
  } catch {
    // 网页搜索失败时静默回退到备用数据源
  }

  return searchByApp(normalized, type);
}

async function rankingByApp(kind: RankingKind): Promise<NovelSummary[]> {
  const sorts = RANKING_SORTS[kind];
  let lastError: unknown;

  for (const sort of sorts) {
    try {
      const { items } = await getAppClient().novelList(sort, 1);
      if (items.length > 0) return items;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new Error(`备用数据源榜单获取失败：${errorMessage(lastError)}`);
  }
  return [];
}

/** 首页榜单。网页失败时回退到备用数据源的对应排序。 */
export async function getRanking(kind: RankingKind): Promise<NovelSummary[]> {
  try {
    let page = await webGet(`${WEB_BASE}/index.php`);

    if (page.status === 200 && isLoginRequired(page.html)) {
      const loggedIn = await wenku8Login();
      if (loggedIn) page = await webGet(`${WEB_BASE}/index.php`);
    }

    if (page.status !== 200) throw new Error(`HTTP ${page.status}`);

    const items = parseRankingPage(page.html, kind);
    if (items.length === 0) throw new Error("页面中没有解析到榜单数据");
    return items;
  } catch {
    // 网页榜单失败时静默回退到备用数据源
  }

  return rankingByApp(kind);
}
