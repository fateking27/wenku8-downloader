import { load } from "cheerio";
import { refreshAppCookie } from "../app/instance";
import { SEARCH_BASE, SETTINGS, WEB_BASE, loadWenku8Config, saveWenku8Config } from "../config";
import { warn } from "../log";
import { sleep } from "../util/async";
import { decodeGbk, getSetCookies, mergeCookies } from "../util/text";
import { request } from "./client";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/535.20 (KHTML, like Gecko) Chrome/19.0.1036.7 Safari/535.20",
  "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9.0.8) Gecko Fedora/1.9.0.8-1.fc10 Kazehakase/0.5.6",
  "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Acoo Browser; SLCC1; .NET CLR 2.0.50727)",
  "Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; fr) Presto/2.9.168 Version/11.52",
];

export function randomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index] ?? USER_AGENTS[0]!;
}

export function randomIp(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");
}

export function webHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    cookie: loadWenku8Config().cookie ?? "",
    referer: `${WEB_BASE}/index.php`,
    "user-agent": randomUserAgent(),
    "x-forwarded-for": randomIp(),
    "x-real-ip": "127.0.0.1",
    ...extra,
  };
}

export interface WebPage {
  status: number;
  ok: boolean;
  url: string;
  html: string;
  bytes: Uint8Array;
}

export interface WebGetOptions {
  referer?: string;
  /** 总请求次数（含首次），默认 SETTINGS.webAttempts（5 次）。 */
  attempts?: number;
  /** 重试间隔基数，测试时可传 0。 */
  retryDelayMs?: number;
  timeoutMs?: number;
}

/**
 * 抓取 GBK 编码的网页。
 *
 * 网页端可能被 Cloudflare 拦截（403）或短暂超时，因此默认连续请求 5 次；
 * 5 次仍未成功才由上层切换到备用数据源。404 / 410 是明确的“不存在”，不重试。
 */
export async function webGet(url: string, options: WebGetOptions = {}): Promise<WebPage> {
  const extra: Record<string, string> = {};
  if (options.referer) extra.referer = options.referer;

  const attempts = Math.max(1, options.attempts ?? SETTINGS.webAttempts);
  const retryDelayMs = options.retryDelayMs ?? SETTINGS.webRetryDelayMs;
  const timeoutMs = options.timeoutMs ?? SETTINGS.httpTimeoutMs;

  let lastPage: WebPage | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request(url, {
        headers: webHeaders(extra),
        timeoutMs,
        retries: 0,
      });

      const page: WebPage = {
        status: response.status,
        ok: response.ok,
        url: response.url,
        html: decodeGbk(response.bytes),
        bytes: response.bytes,
      };

      if (page.status === 200 || page.status === 404 || page.status === 410) {
        return page;
      }

      lastPage = page;
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(retryDelayMs * attempt);
    }
  }

  if (lastPage) return lastPage;
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** 登录页或权限提示页会显示 “用户登录” 这个标题。 */
export function isLoginRequired(html: string): boolean {
  const $ = load(html);
  const caption = $("#content").find(".grid>caption").first().text().trim();
  return caption === "用户登录";
}

let loginPromise: Promise<boolean> | null = null;

export interface LoginOptions {
  /** 不传时使用 wenku8.json / 环境变量中的账号。 */
  username?: string;
  password?: string;
  /** 总尝试次数（含首次），默认 SETTINGS.loginAttempts（5 次）。 */
  attempts?: number;
  /** 重试间隔基数，测试时可传 0。 */
  retryDelayMs?: number;
  /** 每次尝试前回调，用于 UI 显示第几次登录。 */
  onAttempt?: (attempt: number, total: number) => void;
  /** 成功后是否写回 Cookie，默认 true；测试时可关闭。 */
  persist?: boolean;
}

/**
 * 使用账号密码登录 wenku8。
 *
 * 默认连续尝试 5 次（含首次），全部失败才返回 false；
 * 「账户设置」会通过 onAttempt 显示当前是第几次。
 */
export function wenku8Login(options: LoginOptions = {}): Promise<boolean> {
  if (loginPromise) return loginPromise;

  const promise = attemptLogin(options);
  loginPromise = promise;

  const clear = (): void => {
    if (loginPromise === promise) loginPromise = null;
  };
  void promise.then(clear, clear);

  return promise;
}

async function attemptLogin(options: LoginOptions): Promise<boolean> {
  const config = loadWenku8Config();
  // 配置文件优先，便于「账户设置」菜单修改后立即生效；环境变量仅作兜底。
  const username = options.username ?? (config.username || process.env.WENKU8_USERNAME || "");
  const password = options.password ?? (config.password || process.env.WENKU8_PASSWORD || "");

  if (!username || !password) {
    warn("未配置文库账号，无法自动登录（可在 wenku8.json 填写 username/password");
    return false;
  }

  const attempts = Math.max(1, options.attempts ?? SETTINGS.loginAttempts);
  const retryDelayMs = options.retryDelayMs ?? SETTINGS.loginRetryDelayMs;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    options.onAttempt?.(attempt, attempts);
    if (await doLogin(username, password, options.persist !== false)) return true;
    if (attempt < attempts) await sleep(retryDelayMs * attempt);
  }

  return false;
}

async function doLogin(username: string, password: string, persist: boolean): Promise<boolean> {
  const form = new URLSearchParams({
    username,
    password,
    usecookie: "315360000",
    action: "login",
    submit: " 登  录 ",
  });

  try {
    const response = await request(
      `${WEB_BASE}/login.php?do=submit&jumpurl=${encodeURIComponent(`${WEB_BASE}/index.php`)}`,
      {
        method: "POST",
        headers: webHeaders({
          "content-type": "application/x-www-form-urlencoded",
          referer: `${WEB_BASE}/login.php`,
        }),
        body: form,
        retries: 0,
      },
    );

    const cookies = getSetCookies(response.headers);
    const merged = mergeCookies(cookies);
    const body = decodeGbk(response.bytes);
    // 成功时服务端会写 jieqiUserInfo，并返回 “登录成功” 页面；
    // 失败时通常只有游客 PHPSESSID，不能仅凭“有 Cookie”判断成功。
    const success = merged.includes("jieqiUserInfo=") || body.includes("登录成功");

    if (!success || !merged) return false;

    if (persist) {
      const config = loadWenku8Config();
      saveWenku8Config({ ...config, cookie: merged });
      refreshAppCookie(merged);
    }
    return true;
  } catch {
    return false;
  }
}

/** 搜索接口地址（GBK 编码的 searchkey 由调用方拼好）。 */
export function searchUrl(searchType: string, encodedKeyword: string): string {
  return `${SEARCH_BASE}?searchtype=${searchType}&searchkey=${encodedKeyword}`;
}
