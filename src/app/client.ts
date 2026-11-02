import { RELAY_BASE, SETTINGS } from "../config";
import { request } from "../http/client";
import { errorMessage } from "../log";
import type { Language, NovelSummary, VolumeRef } from "../types";
import { sleep } from "../util/async";
import { cookieValue, getSetCookies } from "../util/text";
import { DEFAULT_VER, magicAppver, resolveFlavor } from "./appver";
import { appApi, coverUrl, type SortKey } from "./endpoints";
import { childElements, dataMap, findElement, firstChild, parseXml, textOf, type XmlNode } from "./xml";

export type AppErrorKind = "network" | "signature" | "http" | "auth" | "parse";

export class AppApiError extends Error {
  readonly kind: AppErrorKind;
  readonly status: number | undefined;

  constructor(message: string, kind: AppErrorKind, status?: number) {
    super(message);
    this.name = "AppApiError";
    this.kind = kind;
    this.status = status;
  }
}

export interface AppClientOptions {
  cookie?: string;
  ver?: string;
  flavor?: string;
  language?: Language;
  timeoutMs?: number;
  retries?: number;
  /** 会话变化时回调，便于持久化 Cookie。 */
  onCookie?: (cookie: string) => void;
}

export interface AppResponse {
  status: number;
  text: string;
  bytes: Uint8Array;
  setCookie: string | null;
}

function canonicalCookie(cookie: string): string {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .sort()
    .join("; ");
}

function isImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return jpeg || png || gif || webp;
}

function toSummary(item: XmlNode): NovelSummary {
  const data = dataMap(item);
  const aid = item.attrs["aid"] ?? data["aid"] ?? "";
  const numericAid = Number(aid);
  return {
    id: aid,
    name: data["Title"] ?? "",
    author: data["Author"] ?? "",
    tags: data["Tags"] ?? "",
    cover: Number.isFinite(numericAid) && numericAid > 0 ? coverUrl(numericAid) : undefined,
    brief: data["IntroPreview"] ?? "",
    extra: data["LastUpdate"] ?? "",
  };
}

/**
 * `&appver=<签名>&request=<Base64(参数串)>&timetoken=<毫秒时间戳>`
 */
export class AppClient {
  readonly ver: string;
  readonly flavor: string;
  readonly language: Language;

  private cookie: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly onCookie: ((cookie: string) => void) | undefined;

  constructor(options: AppClientOptions = {}) {
    this.ver = options.ver ?? DEFAULT_VER;
    this.flavor = resolveFlavor(this.ver, options.flavor);
    this.language = options.language ?? 0;
    this.cookie = options.cookie ?? "";
    this.timeoutMs = options.timeoutMs ?? SETTINGS.appTimeoutMs;
    this.retries = options.retries ?? SETTINGS.appRetries;
    this.onCookie = options.onCookie;
  }

  getCookie(): string {
    return this.cookie;
  }

  /** 网页登录成功后同步 Cookie，避免数据接口继续使用过期会话。 */
  reloadCookie(cookie: string): void {
    this.cookie = cookie;
  }

  /** 当前分钟桶对应的 appver（只读展示用）。 */
  get appver(): string {
    return magicAppver({ ver: this.ver, flavor: this.flavor });
  }

  /** 发送一次数据接口请求并返回原始响应。 */
  async call(params: string): Promise<AppResponse> {
    let signatureError: AppApiError | null = null;

    // 签名原文包含「分钟桶」，恰好在整分钟边界发出的请求可能被判定为过期，
    // 因此 400 时重新计算 appver 再试几次；flavor 真的不匹配时仍会失败。
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      const body =
        `&appver=${this.appver}` +
        `&request=${Buffer.from(params, "utf8").toString("base64")}` +
        `&timetoken=${Date.now()}`;

      const headers: Record<string, string> = {
        "accept-encoding": "gzip",
        "user-agent": "okhttp/4.12.0",
      };
      if (this.cookie) headers["cookie"] = this.cookie;

      let response;
      try {
        response = await request(RELAY_BASE, {
          method: "POST",
          headers,
          body,
          timeoutMs: this.timeoutMs,
          retries: this.retries,
          redirect: "manual",
        });
      } catch (error) {
        throw new AppApiError(`数据接口请求失败：${errorMessage(error)}`, "network");
      }

      if (response.status === 400) {
        signatureError = new AppApiError(
          `数据接口拒绝了请求（appver 签名或 flavor 不匹配）。当前版本 ${this.ver} / flavor ${this.flavor}，` +
            "可在 wenku8.json 的 app 配置中更换版本或显式指定 flavor。",
          "signature",
          400,
        );
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppApiError(
          `数据接口鉴权失败（HTTP ${response.status}），请检查 wenku8.json 中的 Cookie`,
          "auth",
          response.status,
        );
      }
      if (response.status !== 200) {
        throw new AppApiError(`数据接口返回 HTTP ${response.status}`, "http", response.status);
      }

      const text = new TextDecoder("utf-8").decode(response.bytes).replace(/^\uFEFF/, "");
      const setCookies = getSetCookies(response.headers);
      const session = cookieValue(setCookies, "PHPSESSID");
      if (session) this.mergeSession(session);

      return {
        status: response.status,
        text,
        bytes: response.bytes,
        setCookie: setCookies.length > 0 ? setCookies.join(", ") : null,
      };
    }

    throw signatureError ?? new AppApiError("数据接口请求失败", "signature");
  }

  private mergeSession(session: string): void {
    const parts = this.cookie
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.startsWith("PHPSESSID="));
    const next = [`PHPSESSID=${session}`, ...parts].join("; ");

    // 数据接口经常回传同一个会话，没必要每次请求都重写配置文件。
    if (canonicalCookie(next) === canonicalCookie(this.cookie)) return;

    this.cookie = next;
    this.onCookie?.(next);
  }

  private async requestXml(params: string): Promise<XmlNode> {
    const response = await this.call(params);
    const root = parseXml(response.text);
    if (root) return root;

    const trimmed = response.text.trim();
    if (/^\d+$/.test(trimmed)) {
      throw new AppApiError(`数据接口返回错误码 ${trimmed}（可能需要登录，请配置 Cookie）`, "auth");
    }
    if (/bad request/i.test(trimmed)) {
      throw new AppApiError("数据接口返回 Bad request（appver 签名无效）", "signature");
    }
    throw new AppApiError(`无法解析 数据接口响应：${trimmed.slice(0, 120) || "(空响应)"}`, "parse");
  }

  async meta(aid: number): Promise<Record<string, string>> {
    const root = await this.requestXml(appApi.bookMeta(aid, this.language));
    return dataMap(findElement(root, "metadata") ?? root);
  }

  async info(aid: number): Promise<Record<string, string>> {
    const root = await this.requestXml(appApi.bookInfo(aid));
    return dataMap(findElement(root, "metadata") ?? root);
  }

  async intro(aid: number): Promise<string> {
    const response = await this.call(appApi.bookIntro(aid, this.language));
    return response.text.trim();
  }

  async volumeList(aid: number, lang: Language = this.language): Promise<VolumeRef[]> {
    const root = await this.requestXml(appApi.bookVolumeList(aid, lang));
    const pkg = root.tag === "package" ? root : (findElement(root, "package") ?? root);

    return childElements(pkg, "volume")
      .map((volume) => ({
        id: volume.attrs["vid"] ?? "",
        name: textOf(volume) || "未命名分卷",
        chapters: childElements(volume, "chapter")
          .map((chapter) => ({
            id: chapter.attrs["cid"] ?? "",
            title: textOf(chapter),
          }))
          .filter((chapter) => chapter.id.length > 0),
      }))
      .filter((volume) => volume.chapters.length > 0);
  }

  async chapterText(aid: number, cid: number, lang: Language = this.language): Promise<string> {
    const response = await this.call(appApi.bookText(aid, cid, lang));
    const text = response.text;
    const trimmed = text.trim();

    if (!trimmed) {
      throw new AppApiError(`章节 ${cid} 内容为空`, "parse");
    }
    if (/^\d+$/.test(trimmed)) {
      throw new AppApiError(`章节 ${cid} 返回错误码 ${trimmed}（可能需要登录）`, "auth");
    }
    return text;
  }

  async cover(aid: number): Promise<Uint8Array> {
    const response = await this.call(appApi.bookCover(aid));
    if (!isImage(response.bytes)) {
      throw new AppApiError(`封面 ${aid} 的响应不是图片`, "parse");
    }
    return response.bytes;
  }

  async search(keyword: string, by: "title" | "author" = "title", lang: Language = this.language): Promise<NovelSummary[]> {
    const params = by === "author" ? appApi.searchByAuthor(keyword, lang) : appApi.searchByTitle(keyword, lang);
    const root = await this.requestXml(params);
    return childElements(root, "item")
      .map((item) => toSummary(item))
      .filter((item) => item.id.length > 0);
  }

  async novelList(
    sort: SortKey,
    page = 1,
    lang: Language = this.language,
  ): Promise<{ pages: number; items: NovelSummary[] }> {
    const root = await this.requestXml(appApi.novelList(sort, page, lang));
    const pageNode = firstChild(root, "page");
    return {
      pages: Number(pageNode?.attrs["num"] ?? 0) || 0,
      items: childElements(root, "item")
        .map((item) => toSummary(item))
        .filter((item) => item.id.length > 0),
    };
  }

  /** 登录成功返回 true（并保存 PHPSESSID）。 */
  async login(username: string, password: string): Promise<boolean> {
    const response = await this.call(appApi.login(username, password));
    if (response.status !== 200) return false;

    const text = response.text.trim();
    if (/^\d+$/.test(text) && text !== "0") return false;
    return (response.setCookie ?? "").includes("PHPSESSID=") || this.cookie.includes("PHPSESSID=");
  }

  async userInfo(): Promise<Record<string, string> | null> {
    const root = await this.requestXml(appApi.userInfo());
    const node = findElement(root, "metadata") ?? root;
    const data = dataMap(node);
    return Object.keys(data).length > 0 ? data : null;
  }
}
