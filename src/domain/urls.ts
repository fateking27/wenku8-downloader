import { PACK_TXT_BASE, WEB_BASE } from "../config";

export function webBookUrl(novelId: string): string {
  return `${WEB_BASE}/book/${novelId}.htm`;
}

/** 目录页：/novel/{首位数字或 0}/{id}/index.htm */
export function webIndexUrl(novelId: string): string {
  const prefix = novelId.length < 4 ? "0" : (novelId.charAt(0) || "0");
  return `${WEB_BASE}/novel/${prefix}/${novelId}/index.htm`;
}

export function webChapterUrl(novelId: string, chapterId: string): string {
  const prefix = novelId.length < 4 ? "0" : (novelId.charAt(0) || "0");
  return `${WEB_BASE}/novel/${prefix}/${novelId}/${chapterId}.htm`;
}

/** 整卷 TXT 打包接口（普通小说可用，速度最快）。 */
export function packTxtUrl(novelId: string, volumeId: string): string {
  return `${PACK_TXT_BASE}?aid=${novelId}&vid=${volumeId}`;
}
