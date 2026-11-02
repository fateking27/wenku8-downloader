import { IMG_BASE, RELAY_BASE } from "../config";
import type { Language } from "../types";

export { RELAY_BASE };

/** 排行榜 / 书单的排序键。 */
export const SORT_KEYS = [
  "allvisit",
  "allvote",
  "monthvisit",
  "monthvote",
  "weekvisit",
  "weekvote",
  "dayvisit",
  "dayvote",
  "postdate",
  "lastupdate",
  "goodnum",
  "size",
  "fullflag",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export const SC: Language = 0;
export const TC: Language = 1;

const encode = encodeURIComponent;

/**
 * 各接口的参数串（Base64 之前的内容）。
 * 与 App 内 `a;->c/d/e/...` 的构造逐字节一致。
 */
export const appApi = {
  bookCover: (aid: number) => `action=book&do=cover&aid=${aid}`,
  bookInfo: (aid: number) => `action=book&do=bookinfo&aid=${aid}`,
  bookIntro: (aid: number, lang: Language = SC) => `action=book&do=intro&aid=${aid}&t=${lang}`,
  bookMeta: (aid: number, lang: Language = SC) => `action=book&do=meta&aid=${aid}&t=${lang}`,
  bookVolumeList: (aid: number, lang: Language = SC) => `action=book&do=list&aid=${aid}&t=${lang}`,
  bookText: (aid: number, cid: number, lang: Language = SC) =>
    `action=book&do=text&aid=${aid}&cid=${cid}&t=${lang}`,
  novelList: (sort: SortKey, page = 1, lang: Language = SC) =>
    `action=novellist&sort=${sort}&page=${page}&t=${lang}`,
  searchByTitle: (keyword: string, lang: Language = SC) =>
    `action=search&searchtype=articlename&searchkey=${encode(keyword)}&t=${lang}`,
  searchByAuthor: (keyword: string, lang: Language = SC) =>
    `action=search&searchtype=author&searchkey=${encode(keyword)}&t=${lang}`,
  login: (username: string, password: string) =>
    `action=login&username=${encode(username)}&password=${encode(password)}`,
  loginByEmail: (email: string, password: string) =>
    `action=loginemail&username=${encode(email)}&password=${encode(password)}`,
  logout: () => "action=logout",
  userInfo: () => "action=userinfo",
} as const;

/** 封面 CDN 模板：img.wenku8.com/image/{aid/1000}/{aid}/{aid}s.jpg */
export function coverUrl(aid: number): string {
  if (!Number.isFinite(aid) || aid <= 0) return "";
  return `${IMG_BASE}/${Math.floor(aid / 1000)}/${aid}/${aid}s.jpg`;
}
