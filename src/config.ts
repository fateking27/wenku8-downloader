import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Language } from "./types";

/** 运行时根目录（可执行文件所在目录 / 启动时的工作目录）。 */
export const ROOT = process.cwd();

/** 与 package.json 保持一致的版本号。 */
export const APP_VERSION = "0.3.1";

export const PATHS = {
  wenku8: path.join(ROOT, "wenku8.json"),
  proxy: path.join(ROOT, "proxy.config.json"),
  novels: path.join(ROOT, "novels"),
  epub: path.join(ROOT, "novels", "epub"),
  txt: path.join(ROOT, "novels", "txt"),
  images: path.join(ROOT, "插图"),
  assets: path.join(ROOT, "assets"),
  noCover: path.join(ROOT, "assets", "nocover.jpg"),
} as const;

export const WEB_BASE = "https://www.wenku8.net";
export const SEARCH_BASE = `${WEB_BASE}/modules/article/search.php`;
export const IMG_BASE = "https://img.wenku8.com/image";
export const PACK_TXT_BASE = "https://dl.wenku8.com/packtxt.php";
export const RELAY_BASE = "https://wenku8-relay.mewx.org/";

/** 可调参数集中在这里，避免散落在各模块中。 */
export const SETTINGS = {
  /** 单次 HTTP 请求超时。 */
  httpTimeoutMs: 30_000,
  /** 通用重试次数（不含首次请求）。 */
  httpRetries: 2,
  /** 重试基础间隔，实际间隔按次数线性增长。 */
  httpRetryDelayMs: 2_000,
  /** 网页抓取总尝试次数（含首次），连续失败后才会切换到 App 中继。 */
  webAttempts: 5,
  /** 网页重试间隔基数，按尝试次数线性增长。 */
  webRetryDelayMs: 1_000,
  /** 逐章抓取之间的间隔，避免触发站点限流。 */
  chapterDelayMs: 900,
  /** App 中继逐章请求间隔（中继限流较宽松）。 */
  appChapterDelayMs: 400,
  /** 插图下载并发数。 */
  imageConcurrency: 4,
  /** packtxt 整卷下载超时。 */
  packTxtTimeoutMs: 60_000,
  /** App 中继请求超时。 */
  appTimeoutMs: 30_000,
  /** App 中继重试次数。 */
  appRetries: 2,
  /** 登录连续尝试次数（含首次），全部失败后才提示用户。 */
  loginAttempts: 5,
  /** 登录重试间隔基数，按次数线性增长。 */
  loginRetryDelayMs: 1_000,
} as const;

export interface ProxyFileConfig {
  proxy: boolean;
  noProxyUrls: string[];
  proxyList: string[];
}

export interface AppFileConfig {
  /** App 中继版本号，默认 1.30。 */
  ver?: string;
  /** 与版本配对的 flavor；留空则按内置表推导。 */
  flavor?: string;
  /** 内容语言：0 简体 / 1 繁体。 */
  language?: Language;
}

export interface Wenku8FileConfig {
  /** wenku8 站点 Cookie（PHPSESSID 等）。 */
  cookie?: string;
  /** 自动登录用的账号（也可用环境变量 WENKU8_USERNAME / WENKU8_PASSWORD）。 */
  username?: string;
  password?: string;
  app?: AppFileConfig;
}

const DEFAULT_PROXY: ProxyFileConfig = {
  proxy: false,
  noProxyUrls: [
    "pic.777743.xyz",
    "img.wenku8.com",
    "www.wenku8.net/login.php",
    "www.wenku8.net/index.php",
    "www.wenku8.net/modules/article/search.php",
    "www.wenku8.net/book",
    "wenku8-relay.mewx.org",
  ],
  proxyList: [],
};

const DEFAULT_WENKU8: Wenku8FileConfig = { cookie: "" };

export function readJsonFile<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(file: string, data: unknown): void {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function loadProxyConfig(): ProxyFileConfig {
  const raw = readJsonFile<Partial<ProxyFileConfig>>(PATHS.proxy) ?? {};
  return {
    proxy: typeof raw.proxy === "boolean" ? raw.proxy : DEFAULT_PROXY.proxy,
    noProxyUrls: Array.isArray(raw.noProxyUrls) ? raw.noProxyUrls : DEFAULT_PROXY.noProxyUrls,
    proxyList: Array.isArray(raw.proxyList) ? raw.proxyList : DEFAULT_PROXY.proxyList,
  };
}

export function saveProxyConfig(config: ProxyFileConfig): void {
  writeJsonFile(PATHS.proxy, config);
}

export function loadWenku8Config(): Wenku8FileConfig {
  const raw = readJsonFile<Partial<Wenku8FileConfig>>(PATHS.wenku8) ?? {};
  return {
    ...DEFAULT_WENKU8,
    ...raw,
    app: raw.app ?? {},
  };
}

export function saveWenku8Config(config: Wenku8FileConfig): void {
  const next: Wenku8FileConfig = { ...config };
  if (next.app && Object.keys(next.app).length === 0) delete next.app;
  writeJsonFile(PATHS.wenku8, next);
}

/** 首次运行时补齐配置文件，避免到处判断文件是否存在。 */
export function ensureRuntimeFiles(): void {
  if (!existsSync(PATHS.proxy)) {
    writeJsonFile(PATHS.proxy, DEFAULT_PROXY);
  }
  if (!existsSync(PATHS.wenku8)) {
    writeJsonFile(PATHS.wenku8, DEFAULT_WENKU8);
  }
}
