import { loadWenku8Config, saveWenku8Config } from "../config";
import { AppClient } from "./client";

let client: AppClient | null = null;

function createClient(): AppClient {
  const config = loadWenku8Config();

  return new AppClient({
    cookie: config.cookie ?? "",
    ver: config.app?.ver,
    flavor: config.app?.flavor,
    language: config.app?.language,
    onCookie: (cookie) => {
      const latest = loadWenku8Config();
      saveWenku8Config({ ...latest, cookie });
    },
  });
}

/** 进程内共享的数据接口客户端（Cookie 变化会自动写回 wenku8.json）。 */
export function getAppClient(): AppClient {
  client ??= createClient();
  return client;
}

/** 配置变更后可重置单例（主要用于测试）。 */
export function resetAppClient(): void {
  client = null;
}

/** 网页登录拿到新 Cookie 后同步给已创建的数据接口客户端。 */
export function refreshAppCookie(cookie: string): void {
  client?.reloadCookie(cookie);
}
