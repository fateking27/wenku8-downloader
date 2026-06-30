import { fetch } from "bun";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import proxyConfig from "../proxy.config.json";

let timer = null;

const getProxyFunc = async () => {
  clearTimeout(timer);
  timer = null;

  try {
    // 从代理池获取代理
    const proxyRes = await fetch(
      "https://proxy.scdn.io/api/get_proxy.php?protocol=http&count=20",
    );

    const { data } = await proxyRes.json();

    const test_proxy_func = async (proxy_url) => {
      try {
        const res = await fetch("https://www.wenku8.net/login.php", {
          proxy: `http://${proxy_url}`,
          method: "GET",
          signal: AbortSignal.timeout(30000),
          headers: {
            referer: "https://www.wenku8.net/index.php",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          },
        });
        const resBody = await res.arrayBuffer();
        const html = iconv.decode(Buffer.from(resBody), "gbk");
        const $ = cheerio.load(html);
        const mark = $("#content").find(".grid>caption").text()?.trim() || null;

        switch (res.status) {
          case 200:
            if (mark !== "用户登录") break;

            // 检查代理是否已存在
            const proxy_config = await Bun.file(
              path.join(process.cwd(), "proxy.config.json"),
            ).json();
            if (proxy_config.proxyList.indexOf(proxy_url) !== -1) break;

            // console.log(
            //   styleText(
            //     "bgGreen",
            //     `Success: [${proxy_url}]，Test Proxy Success !\n`,
            //   ),
            // );

            proxyConfig.proxyList.push(proxy_url);
            fs.writeFileSync(
              path.join(__dirname, "../proxy.config.json"),
              JSON.stringify(proxyConfig, null, 2),
            );
            break;
          default:
            break;
        }
      } catch (error) {
        // console.log(
        //   styleText("redBright", `\nError: [${proxy_url}] ${error.message}`),
        // );
      }
    };

    await Promise.all(
      data.proxies.map((proxy_url) => test_proxy_func(proxy_url)),
    );

    timer = setTimeout(getProxyFunc, 1000 * 30);
  } catch (error) {
    // console.log(styleText("redBright", "\n获取代理获取代理失败:", error));
    return setTimeout(getProxyFunc, 1000 * 20);
  }
};

// getProxyFunc();

//定期检测代理是否可用
const checkProxyFunc = async () => {
  const proxy_config = await Bun.file(
    path.join(process.cwd(), "proxy.config.json"),
  ).json();
  if (!proxy_config.proxyList || proxy_config.proxyList.length === 0) return;
  const proxyList = proxy_config.proxyList;

  const test_proxy_func = async (proxy_url) => {
    try {
      const res = await fetch("https://www.wenku8.net/login.php", {
        proxy: `http://${proxy_url}`,
        method: "GET",
        signal: AbortSignal.timeout(30000),
        headers: {
          referer: "https://www.wenku8.net/index.php",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
      });
      if (res.status !== 200) {
        proxyConfig.proxyList = proxyConfig.proxyList.filter(
          (item) => item !== proxy_url,
        );
        fs.writeFileSync(
          path.join(__dirname, "../proxy.config.json"),
          JSON.stringify(proxyConfig, null, 2),
        );
        return;
      }
    } catch (error) {}
  };

  await Promise.all(proxyList.map((proxy_url) => test_proxy_func(proxy_url)));
};

// setInterval(checkProxyFunc, 1000 * 60);

/**
 * 获取代理IP
 * @returns {Promise<string|boolean>} 代理IP或false
 */
export const getProxyUrl = () => {
  return new Promise(async (resolve) => {
    try {
      const proxy_config = await Bun.file(
        path.join(process.cwd(), "proxy.config.json"),
      ).json();

      if (!proxy_config.proxy) return resolve(false);

      const proxyList = proxy_config.proxyList;
      if (!proxyList || proxyList.length === 0) return resolve(false);
      const proxyUrl = proxyList[Math.floor(Math.random() * proxyList.length)];
      resolve(proxyUrl);
    } catch (error) {
      //   console.log("获取代理IP失败", error.message);
      resolve(false);
    }
  });
};

/**
 * 获取代理状态
 * @returns {Promise<boolean>} 代理状态
 */
export const getProxyStatus = async () => {
  const proxy_config = await Bun.file(
    path.join(process.cwd(), "proxy.config.json"),
  ).json();
  return proxy_config.proxy;
};
