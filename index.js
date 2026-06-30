import { styleText } from "util";
import { options } from "./src/options/index.js";
import { getProxyStatus } from "./utils/proxyPool.js";

console.log(
  styleText(
    "green",
    "欢迎使用wenku8轻小说文库下载器，https://github.com/fateking27/wenku8-downloader\n",
  ),
);

const start = async () => {
  const proxyStatus = await getProxyStatus();
  if (!proxyStatus) {
    console.log("未启用代理：", styleText("yellow", `${proxyStatus}\n`));
  } else {
    console.log("已启用代理：", styleText("green", `${proxyStatus}\n`));
  }

  await options();
  return start(); // 重新开始操作
};

// 启动程序
start().catch((error) => {
  console.error("发生错误:", error);
});
