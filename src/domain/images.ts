import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { coverUrl } from "../app/endpoints";
import { getAppClient } from "../app/instance";
import { PATHS, SETTINGS, WEB_BASE } from "../config";
import { request } from "../http/client";
import { errorMessage, warn } from "../log";
import type { NovelDetail } from "../types";
import { mapLimit } from "../util/async";
import { ensureDir, isNonEmptyFile, sanitizeFileName } from "../util/fs";
import { absoluteUrl } from "../web/parse";

const IMAGE_EXT_BY_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
};

const KNOWN_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"]);

function extensionFor(contentType: string | null, url: string): string {
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const byType = IMAGE_EXT_BY_TYPE[type];
  if (byType) return byType;

  const fromUrl = path.extname((url.split("?")[0] ?? "").toLowerCase()).toLowerCase();
  if (KNOWN_EXTENSIONS.has(fromUrl)) return fromUrl === ".jpeg" ? ".jpg" : fromUrl;
  return ".jpg";
}

/** 图片保存文件名（保留原文件名，非法字符做替换）。 */
export function imageFileName(url: string, fallback = "image"): string {
  const withoutQuery = url.split("?")[0] ?? url;
  const base = withoutQuery.split("/").pop() ?? "";
  let decoded = base;
  try {
    decoded = decodeURIComponent(base);
  } catch {
    // 保持原样
  }

  const safe = sanitizeFileName(decoded || fallback);
  return KNOWN_EXTENSIONS.has(path.extname(safe).toLowerCase()) ? safe : `${safe}.jpg`;
}

export function novelImageDir(novelName: string): string {
  return path.join(PATHS.images, sanitizeFileName(novelName));
}

export function volumeImageDir(novelName: string, volumeName: string): string {
  return path.join(novelImageDir(novelName), sanitizeFileName(volumeName));
}

export interface DownloadImageOptions {
  referer?: string;
  /** 指定文件名（不含扩展名），用于封面等固定名字的文件。 */
  fileName?: string;
}

function findFileWithBase(dir: string, baseName: string): string | null {
  try {
    const files = readdirSync(dir);
    const hit = files.find((file) => path.parse(file).name === baseName);
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

/** 下载单张图片，失败返回 null（不中断整体流程）。 */
export async function downloadImage(url: string, dir: string, options: DownloadImageOptions = {}): Promise<string | null> {
  const resolved = absoluteUrl(url);
  if (!resolved || resolved.startsWith("data:")) return null;

  if (options.fileName) {
    const existing = findFileWithBase(dir, options.fileName);
    if (existing && isNonEmptyFile(existing)) return existing;
  } else {
    const existing = path.join(dir, imageFileName(resolved));
    if (isNonEmptyFile(existing)) return existing;
  }

  try {
    const response = await request(resolved, {
      headers: {
        referer: options.referer ?? `${WEB_BASE}/`,
        "user-agent": "okhttp/4.12.0",
      },
      retries: 1,
      timeoutMs: 60_000,
    });

    if (response.status !== 200 || response.bytes.length < 200) return null;

    ensureDir(dir);
    const target = options.fileName
      ? path.join(dir, `${options.fileName}${extensionFor(response.headers.get("content-type"), resolved)}`)
      : path.join(dir, imageFileName(resolved));

    writeFileSync(target, response.bytes);
    return target;
  } catch (error) {
    warn(`插图下载失败：${resolved}（${errorMessage(error)}）`);
    return null;
  }
}

export interface DownloadImagesOptions {
  referer?: string;
  /** 每下载完一张回调，用于更新等待状态。 */
  onProgress?: (done: number, total: number, url: string) => void;
}

/** 并发下载多张插图，返回 “远程地址 → 本地路径” 映射（失败的不在映射中）。 */
export async function downloadImagesWithMap(
  urls: readonly string[],
  dir: string,
  options: DownloadImagesOptions = {},
): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((url) => url.length > 0))];
  const mapping = new Map<string, string>();
  if (unique.length === 0) return mapping;

  let done = 0;
  const results = await mapLimit(unique, SETTINGS.imageConcurrency, async (url) => {
    const file = await downloadImage(url, dir, options.referer ? { referer: options.referer } : {});
    done += 1;
    options.onProgress?.(done, unique.length, url);
    return file;
  });

  unique.forEach((url, index) => {
    const file = results[index];
    if (file) mapping.set(url, file);
  });

  return mapping;
}

/** 并发下载多张插图，返回成功的本地路径。 */
export async function downloadImages(
  urls: readonly string[],
  dir: string,
  options: DownloadImagesOptions = {},
): Promise<string[]> {
  const mapping = await downloadImagesWithMap(urls, dir, options);
  return [...mapping.values()];
}

function findCover(dir: string): string | null {
  try {
    const hit = readdirSync(dir).find((file) => /^cover\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(file));
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

/**
 * 下载封面。
 */
export async function downloadCover(detail: NovelDetail): Promise<string | null> {
  const dir = novelImageDir(detail.name);
  ensureDir(dir);

  const existing = findCover(dir);
  if (existing && isNonEmptyFile(existing)) return existing;

  const aid = Number(detail.id);
  const candidates: string[] = [];
  if (detail.cover) candidates.push(detail.cover);
  if (Number.isFinite(aid) && aid > 0) candidates.push(coverUrl(aid));

  for (const url of candidates) {
    const saved = await downloadImage(url, dir, { fileName: "cover" });
    if (saved) return saved;
  }

  if (!Number.isFinite(aid) || aid <= 0) return null;

  try {
    const bytes = await getAppClient().cover(aid);
    const target = path.join(dir, "cover.jpg");
    writeFileSync(target, bytes);
    return target;
  } catch {
    return null;
  }
}
