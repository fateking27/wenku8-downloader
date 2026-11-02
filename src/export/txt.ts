import { writeFileSync } from "node:fs";
import path from "node:path";
import { PATHS, SETTINGS, WEB_BASE } from "../config";
import { fetchChapter, isIllustrationChapter } from "../domain/content";
import { packTxtUrl } from "../domain/urls";
import { request } from "../http/client";
import { errorMessage, fail, start, stop, succeed, warn } from "../log";
import type { Catalog, ExportResult, NovelDetail, VolumeRef } from "../types";
import { sleep } from "../util/async";
import { ensureDir, isNonEmptyFile, sanitizeFileName } from "../util/fs";
import { decodeText } from "../util/text";

/** packtxt 在参数错误时也会返回 200，只是内容变成一段固定的宣传语。 */
export function isPromoOnly(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 400) return true;
  if (trimmed.length < 1_000 && /更多精彩热门日本轻小说/.test(trimmed)) return true;
  return false;
}

/** 下载整卷 TXT（仅普通网页来源可用）。 */
export async function tryPackTxt(novelId: string, volumeId: string): Promise<string | null> {
  try {
    const response = await request(packTxtUrl(novelId, volumeId), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        referer: `${WEB_BASE}/`,
      },
      retries: 1,
      timeoutMs: SETTINGS.packTxtTimeoutMs,
    });

    if (response.status !== 200) return null;

    const text = decodeText(response.bytes).trim();
    return isPromoOnly(text) ? null : text;
  } catch {
    return null;
  }
}

async function buildVolumeText(
  detail: NovelDetail,
  catalog: Catalog,
  volume: VolumeRef,
  result: ExportResult,
): Promise<string | null> {
  if (catalog.source === "web") {
    start(`正在下载整卷：${volume.name}`);
    const packed = await tryPackTxt(detail.id, volume.id);
    if (packed) {
      succeed(`整卷下载完成：${volume.name}`);
      return `${packed.trim()}\n`;
    }
    warn(`整卷 TXT 不可用，改为逐章下载：${volume.name}`);
  }

  const parts: string[] = [`《${detail.name}》`, volume.name];

  for (const chapter of volume.chapters) {
    if (isIllustrationChapter(chapter.title)) continue;

    start(`开始下载：${volume.name}、${chapter.title}`);

    try {
      const content = await fetchChapter(catalog, chapter);
      const text = content.text.trim();

      if (text) {
        parts.push(`\n${chapter.title}\n\n${text}`);
        succeed(`下载完成：${volume.name}、${chapter.title}`);
      } else {
        warn(`章节内容为空，已跳过：${volume.name}、${chapter.title}`);
      }
    } catch (error) {
      result.failed.push(`${volume.name}/${chapter.title}：${errorMessage(error)}`);
      fail(`下载失败：${volume.name}、${chapter.title}（${errorMessage(error)}）`);
    }

    await sleep(catalog.source === "app" ? SETTINGS.appChapterDelayMs : SETTINGS.chapterDelayMs);
  }

  if (parts.length <= 2) return null;
  return `${parts.join("\n")}\n`;
}

/** 导出 TXT：优先使用整卷 packtxt，失败或版权受限时逐章抓取。 */
export async function exportTxt(
  detail: NovelDetail,
  catalog: Catalog,
  volumes: readonly VolumeRef[],
): Promise<ExportResult> {
  const dir = path.join(PATHS.txt, sanitizeFileName(detail.name));
  ensureDir(dir);

  const result: ExportResult = { dir, files: [], skipped: 0, failed: [] };

  for (const volume of volumes) {
    const target = path.join(dir, `${volume.id}-${sanitizeFileName(volume.name)}.txt`);

    if (isNonEmptyFile(target)) {
      result.skipped += 1;
      succeed(`《${volume.name}》已存在，跳过`);
      continue;
    }

    const text = await buildVolumeText(detail, catalog, volume, result);

    if (!text) {
      fail(`《${volume.name}》没有可写入的内容`);
      continue;
    }

    writeFileSync(target, text, "utf8");
    result.files.push(target);
    succeed(`下载完成：${volume.name}`);
  }

  stop();
  return result;
}
