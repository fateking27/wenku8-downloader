import { loadProxyConfig } from "../config";

/** 是否启用了代理。 */
export function proxyEnabled(): boolean {
  return loadProxyConfig().proxy;
}

/** 给用户看的代理状态描述。 */
export function proxyStatusText(): string {
  const config = loadProxyConfig();
  if (!config.proxy) return "未启用（可在 proxy.config.json 中开启）";
  if (config.proxyList.length === 0) return "已启用，但代理列表为空";
  return `已启用（${config.proxyList.length} 个代理）`;
}

/**
 * 判断某个地址是否应该绕过代理。
 * `noProxyUrls` 中的地址通常是被 Cloudflare 保护的页面或 CDN。
 */
export function shouldBypassProxy(url: string): boolean {
  const config = loadProxyConfig();
  return config.noProxyUrls.some((pattern) => pattern.length > 0 && url.includes(pattern));
}

/** 为一次请求挑选代理；返回 null 表示直连。 */
export function resolveProxy(url: string): string | null {
  const config = loadProxyConfig();
  if (!config.proxy || config.proxyList.length === 0) return null;
  if (shouldBypassProxy(url)) return null;

  const index = Math.floor(Math.random() * config.proxyList.length);
  return config.proxyList[index] ?? null;
}
