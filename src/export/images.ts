import { fetchChapter, isIllustrationChapter } from "../domain/content";
import {
  downloadCover,
  downloadImages,
  novelImageDir,
  volumeImageDir,
} from "../domain/images";
import { errorMessage, fail, start, stop, succeed, warn } from "../log";
import type { Catalog, ExportResult, NovelDetail, VolumeRef } from "../types";
import { sleep } from "../util/async";
import { ensureDir, sanitizeFileName } from "../util/fs";

function fileNameOf(url: string): string {
  const base = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

/** 仅下载插图（含封面）。 */
export async function exportImages(
  detail: NovelDetail,
  catalog: Catalog,
  volumes: readonly VolumeRef[],
): Promise<ExportResult> {
  const dir = novelImageDir(sanitizeFileName(detail.name));
  ensureDir(dir);

  const result: ExportResult = { dir, files: [], skipped: 0, failed: [] };

  start("正在获取封面…");
  const cover = await downloadCover(detail);
  if (cover) {
    succeed(`封面已保存：${fileNameOf(cover)}`);
    result.files.push(cover);
  } else {
    warn("未获取到封面");
    stop();
  }

  for (const volume of volumes) {
    start(`正在下载插图：${volume.name}`);
    const volumeDir = volumeImageDir(detail.name, volume.name);
    let downloaded = 0;
    let foundChapter = false;

    for (const chapter of volume.chapters) {
      if (!isIllustrationChapter(chapter.title)) continue;
      foundChapter = true;

      try {
        start(`正在解析插图：${volume.name}、${chapter.title}`);
        const content = await fetchChapter(catalog, chapter);
        const saved = await downloadImages(content.images, volumeDir, {
          onProgress: (done, total, url) => {
            start(`插图下载中：${fileNameOf(url)}（${done}/${total}）`);
          },
        });

        downloaded += saved.length;
        result.files.push(...saved);
      } catch (error) {
        result.failed.push(`${volume.name}/${chapter.title}：${errorMessage(error)}`);
        fail(`插图获取失败：${volume.name}、${chapter.title}（${errorMessage(error)}）`);
      }

      await sleep(catalog.source === "app" ? 300 : 600);
    }

    if (downloaded > 0) {
      succeed(`《${volume.name}》插图下载完成（${downloaded} 张）`);
    } else if (foundChapter) {
      warn(`《${volume.name}》中的插图获取失败`);
    } else {
      warn(`《${volume.name}》没有插图章节`);
    }
  }

  stop();
  return result;
}
