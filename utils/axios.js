import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "path";
import { getProxyUrl } from "./proxyPool.js";

const axiosCreate = axios.create();
const CancelToken = axios.CancelToken;

// axiosCreate.defaults.timeout = 30000; //请求超时

axiosCreate.interceptors.request.use(async (config) => {
  config.headers["Content-Type"] = "application/x-www-form-urlencoded";
  //设置代理
  const proxyUrl = await getProxyUrl();
  const proxy_config = await Bun.file(
    path.join(process.cwd(), "proxy.config.json"),
  ).json();
  const noProxyUrls = proxy_config.noProxyUrls; // 不使用代理的地址
  const isNoProxy = (url) => {
    for (const noProxyUrl of noProxyUrls) {
      if (url.includes(noProxyUrl)) {
        return false;
      }
    }
    return true;
  };

  if (!proxyUrl || !isNoProxy(config.url)) {
    delete config.httpsAgent;
    config.proxy = false;
  } else if (isNoProxy(config.url)) {
    const httpsAgent = new HttpsProxyAgent("http://" + proxyUrl, {
      rejectUnauthorized: false, //取消证书验证
      keepAlive: false,
    });
    config.proxy = false;
    config.httpsAgent = httpsAgent;
    config.maxContentLength = Infinity;
    // console.log("proxyUrl:", proxyUrl);
  }
  return config;
});

export { axiosCreate, CancelToken };
