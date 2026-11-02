import { SETTINGS } from "../config";
import { sleep } from "../util/async";
import { resolveProxy } from "./proxy";

/** 通用 UA，仅作为兜底；网页请求会使用随机 UA。 */
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export type HttpBody = string | URLSearchParams | Uint8Array;

export interface HttpOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: HttpBody;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  useProxy?: boolean;
  redirect?: "follow" | "manual" | "error";
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  url: string;
  headers: Headers;
  bytes: Uint8Array;
}

interface BunRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: HttpBody;
  redirect: "follow" | "manual" | "error";
  signal: AbortSignal;
  proxy?: string;
  tls?: { rejectUnauthorized?: boolean };
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
  );
}

/**
 * 统一 HTTP 入口：超时、重试、代理都在这里处理。
 *
 * 注意：Bun 的 `fetch` 支持 `proxy` 选项（HTTP 代理），无需额外的 agent 依赖。
 */
export async function request(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = SETTINGS.httpTimeoutMs,
    retries = SETTINGS.httpRetries,
    retryDelayMs = SETTINGS.httpRetryDelayMs,
    useProxy = true,
    redirect = "follow",
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const proxy = useProxy ? resolveProxy(url) : null;
      const init: BunRequestInit = {
        method,
        headers: { "user-agent": DEFAULT_USER_AGENT, ...headers },
        redirect,
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (body !== undefined) init.body = body;
      if (proxy) init.proxy = `http://${proxy}`;

      const response = await fetch(url, init as unknown as RequestInit);
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (isRetryableStatus(response.status) && attempt < retries) {
        lastError = new HttpError(`HTTP ${response.status}`, response.status, url);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return {
        status: response.status,
        ok: response.ok,
        url: response.url || url,
        headers: response.headers,
        bytes,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  if (lastError instanceof HttpError) throw lastError;

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new HttpError(`请求失败：${message}`, 0, url);
}
