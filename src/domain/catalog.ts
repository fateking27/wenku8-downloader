import { getAppClient } from "../app/instance";
import { isLoginRequired, webGet, wenku8Login } from "../http/web";
import { errorMessage, warn } from "../log";
import type { Catalog, NovelDetail } from "../types";
import { parseCatalogPage } from "../web/parse";
import { webIndexUrl } from "./urls";

async function loadWebCatalog(detail: NovelDetail): Promise<Catalog | null> {
  try {
    let page = await webGet(webIndexUrl(detail.id));

    if (page.status === 200 && isLoginRequired(page.html)) {
      const loggedIn = await wenku8Login();
      if (loggedIn) page = await webGet(webIndexUrl(detail.id));
    }

    if (page.status !== 200) return null;

    const parsed = parseCatalogPage(page.html);
    if (!parsed || parsed.volumes.length === 0) return null;

    return {
      source: "web",
      novelId: detail.id,
      title: parsed.title || detail.name,
      author: parsed.author || detail.author,
      volumes: parsed.volumes,
    };
  } catch (error) {
    warn(`网页目录获取失败：${errorMessage(error)}`);
    return null;
  }
}

async function loadAppCatalog(detail: NovelDetail): Promise<Catalog> {
  const aid = Number(detail.id);
  if (!Number.isFinite(aid) || aid <= 0) {
    throw new Error(`小说 ID ${detail.id} 无效`);
  }

  try {
    const volumes = await getAppClient().volumeList(aid);
    if (volumes.length === 0) {
      throw new Error("备用接口没有返回任何分卷");
    }

    return {
      source: "app",
      novelId: detail.id,
      title: detail.name,
      author: detail.author,
      volumes,
    };
  } catch (error) {
    throw new Error(`无法获取《${detail.name}》的目录：${errorMessage(error)}`);
  }
}

/**
 * 获取目录。
 * 网页目录失败时自动回退到备用数据源，因此目录的 `source` 可能与详情不同。
 */
export async function getCatalog(detail: NovelDetail): Promise<Catalog> {
  if (detail.source !== "app") {
    const webCatalog = await loadWebCatalog(detail);
    if (webCatalog) return webCatalog;
  }

  return loadAppCatalog(detail);
}
