/** 语言：0 = 简体，1 = 繁体（对应 App 接口的 `t=` 参数）。 */
export type Language = 0 | 1;

/**
 * 章节内容来源。
 * - `web`：直接抓取 wenku8.net 网页（普通小说）。
 * - `app`：走 App 中继接口（版权受限 / 已下架小说）。
 */
export type CatalogSource = "web" | "app";

/** 首页榜单类型。 */
export type RankingKind = "hot" | "new" | "updated";

export interface ChapterRef {
  /** 网页为章节文件名（如 123456）。 */
  id: string;
  title: string;
}

export interface VolumeRef {
  /** 网页为 vid，分卷缺失时为 "0"。 */
  id: string;
  name: string;
  chapters: ChapterRef[];
}

/** 统一的目录结构。 */
export interface Catalog {
  source: CatalogSource;
  novelId: string;
  title: string;
  author: string;
  volumes: VolumeRef[];
}

export interface NovelDetail {
  id: string;
  name: string;
  author: string;
  tags: string;
  status: string;
  updateTime: string;
  /** 全文字数。 */
  wordCount: string;
  latestChapter: string;
  brief: string;
  /** 远程封面地址，可能为空。 */
  cover: string;
  source: CatalogSource;
  /** 是否为版权受限 / 已下架小说。 */
  restricted: boolean;
  /** 给用户看的补充说明。 */
  note?: string;
}

export interface NovelSummary {
  id: string;
  name: string;
  author: string;
  tags?: string;
  cover?: string;
  brief?: string;
  /** 榜单附加信息（如最近更新时间）。 */
  extra?: string;
}

export interface ChapterContent {
  title: string;
  /** 可直接写入 EPUB 的 HTML 片段。 */
  html: string;
  /** 纯文本，供 TXT 导出使用。 */
  text: string;
  /** 章节内出现的图片地址（已去重）。 */
  images: string[];
}

/** EPUB 生成前，逐卷选择封面时提供给 UI 的上下文。 */
export interface CoverPickContext {
  volumeName: string;
  volumeIndex: number;
  volumeCount: number;
  /** 该分卷的插图目录（已下载的插图都在这里）。 */
  imageDir: string;
  /** 本卷已下载的插图本地路径。 */
  images: string[];
  /** 默认封面（通常是本卷第一张插图）。 */
  defaultCover: string | null;
}

export interface ExportResult {
  dir: string;
  files: string[];
  skipped: number;
  failed: string[];
}
