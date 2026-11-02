import { existsSync } from "node:fs";
import path from "node:path";
import { EPub } from "@lesjoursfr/html-to-epub";
import { PATHS, SETTINGS } from "../config";
import { fetchChapter } from "../domain/content";
import { downloadCover, downloadImagesWithMap, volumeImageDir } from "../domain/images";
import { errorMessage, fail, start, stop, succeed, warn } from "../log";
import type { Catalog, CoverPickContext, ExportResult, NovelDetail, VolumeRef } from "../types";
import { sleep } from "../util/async";
import { ensureDir, isNonEmptyFile, sanitizeFileName } from "../util/fs";

export interface EpubOptions {
  /** 是否下载并嵌入插图，默认 true。 */
  includeImages?: boolean;
  /**
   * 全部内容下载完成后逐卷调用，用于在插图目录中选择封面。
   * 返回 null 表示使用默认封面。
   */
  pickCover?: (context: CoverPickContext) => Promise<string | null>;
}

interface PreparedVolume {
  volume: VolumeRef;
  target: string;
  imageDir: string;
  chapters: { title: string; data: string }[];
  images: string[];
  firstImage: string | null;
  cover: string | null;
}

/**
 * `@lesjoursfr/html-to-epub` 把模板目录硬编码为 `${cwd}/@lesjoursfr/html-to-epub`，
 * 缺失时提前给出可读的错误，而不是在渲染阶段抛出 ENOENT。
 */
function ensureEpubTemplates(): void {
  const templateDir = path.join(process.cwd(), "@lesjoursfr", "html-to-epub", "templates");
  if (!existsSync(templateDir)) {
    throw new Error(
      "缺少 EPUB 模板目录：@lesjoursfr/html-to-epub。请在项目根目录运行，或使用完整解压的发布包。",
    );
  }
}

/**
 * 上游库在有封面时会无条件 `console.log` 封面模板路径（lib/index.js:364，
 * 发生在构造函数里），这里在创建 + 渲染期间过滤掉这一行，避免打断 CLI 输出。
 */
async function withQuietConsole<T>(task: () => Promise<T>): Promise<T> {
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && /cover\.xhtml\.ejs$/.test(first.replace(/\\/g, "/"))) {
      return;
    }
    originalLog(...args);
  };

  try {
    return await task();
  } finally {
    console.log = originalLog;
  }
}

/** 把章节 HTML 里的远程图片地址替换成本地 file:// 地址。 */
function rewriteImageSources(html: string, mapping: ReadonlyMap<string, string>): string {
  let output = html;

  for (const [remote, local] of mapping) {
    const fileUrl = local.startsWith("file://") ? local : `file://${local}`;
    output = output.split(remote).join(fileUrl);

    const escaped = remote.replace(/&/g, "&amp;");
    if (escaped !== remote) output = output.split(escaped).join(fileUrl);
  }

  return output;
}

function fileNameOf(url: string): string {
  const base = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

/** 导出 EPUB（按分卷生成，支持版权受限小说与逐卷自定义封面）。 */
export async function exportEpub(
  detail: NovelDetail,
  catalog: Catalog,
  volumes: readonly VolumeRef[],
  options: EpubOptions = {},
): Promise<ExportResult> {
  ensureEpubTemplates();

  const dir = path.join(PATHS.epub, sanitizeFileName(detail.name));
  ensureDir(dir);

  const result: ExportResult = { dir, files: [], skipped: 0, failed: [] };
  const includeImages = options.includeImages !== false;

  start("正在获取封面…");
  const downloadedCover = await downloadCover(detail);
  if (downloadedCover) {
    succeed("封面获取成功");
  } else {
    warn("未获取到封面，将使用默认封面");
    stop();
  }
  const fallbackCover = downloadedCover ?? PATHS.noCover;

  // 第一阶段：把选中分卷的全部章节与插图下载下来。
  const prepared: PreparedVolume[] = [];

  for (const volume of volumes) {
    const target = path.join(dir, `${volume.id}-${sanitizeFileName(volume.name)}.epub`);

    if (isNonEmptyFile(target)) {
      result.skipped += 1;
      succeed(`《${volume.name}》已存在，跳过`);
      continue;
    }

    const item: PreparedVolume = {
      volume,
      target,
      imageDir: volumeImageDir(detail.name, volume.name),
      chapters: [],
      images: [],
      firstImage: null,
      cover: null,
    };

    for (const chapter of volume.chapters) {
      start(`开始下载：${volume.name}、${chapter.title}`);

      try {
        const content = await fetchChapter(catalog, chapter);
        let html = content.html;

        if (includeImages && content.images.length > 0) {
          start(`插图下载中：${volume.name}、${chapter.title}`);
          const mapping = await downloadImagesWithMap(content.images, item.imageDir, {
            onProgress: (done, total, url) => {
              start(`插图下载中：${fileNameOf(url)}（${done}/${total}）`);
            },
          });

          for (const local of mapping.values()) item.images.push(local);
          if (!item.firstImage) item.firstImage = mapping.values().next().value ?? null;
          html = rewriteImageSources(html, mapping);
        }

        if (html.trim()) item.chapters.push({ title: chapter.title, data: html });
        succeed(`下载完成：${volume.name}、${chapter.title}`);
      } catch (error) {
        result.failed.push(`${volume.name}/${chapter.title}：${errorMessage(error)}`);
        fail(`下载失败：${volume.name}、${chapter.title}（${errorMessage(error)}）`);
      }

      await sleep(catalog.source === "app" ? SETTINGS.appChapterDelayMs : SETTINGS.chapterDelayMs);
    }

    prepared.push(item);
  }

  // 第二阶段：全部内容下载完成后，逐卷跳转到插图目录选择封面。
  if (options.pickCover) {
    for (const [index, item] of prepared.entries()) {
      const defaultCover = item.firstImage ?? fallbackCover;

      if (item.chapters.length === 0) {
        item.cover = defaultCover;
        continue;
      }

      stop();
      let picked: string | null = null;

      try {
        picked = await options.pickCover({
          volumeName: item.volume.name,
          volumeIndex: index + 1,
          volumeCount: prepared.length,
          imageDir: item.imageDir,
          images: item.images,
          defaultCover,
        });
      } catch (error) {
        warn(`选择封面失败：${errorMessage(error)}，使用默认封面`);
      }

      item.cover = picked ?? defaultCover;
    }
  } else {
    for (const item of prepared) {
      item.cover = item.firstImage ?? fallbackCover;
    }
  }

  // 第三阶段：生成 EPUB。
  for (const item of prepared) {
    if (item.chapters.length === 0) {
      fail(`《${item.volume.name}》没有可用的章节`);
      continue;
    }

    start(`正在生成：${item.volume.name}`);
    const cover = item.cover && existsSync(item.cover) ? item.cover : PATHS.noCover;

    try {
      await withQuietConsole(async () => {
        const epub = new EPub(
          {
            title: item.volume.name,
            description: (detail.brief || detail.name).slice(0, 500),
            author: detail.author || "未知",
            cover,
            tocTitle: "目录",
            lang: "zh-CN",
            content: item.chapters,
            verbose: false,
          },
          item.target,
        );

        await epub.render();
      });

      result.files.push(item.target);
      succeed(`生成完成：${item.volume.name}`);
    } catch (error) {
      fail(`《${item.volume.name}》生成失败：${errorMessage(error)}`);
    }
  }

  stop();
  return result;
}
