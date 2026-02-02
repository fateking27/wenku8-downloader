import { styleText } from "util";
import { options } from "./src/options/index.js";
import axios from "axios";
console.log(
  styleText(
    "green",
    "欢迎使用wenku8轻小说文库下载器，https://github.com/fateking27/wenku8-downloader\n"
  )
);

const start = async () => {
  //检测当前网络连接www.wenku8.net的延迟
  const startTime = performance.now();
  const response = await axios.get("https://www.wenku8.net", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    cache: "no-cache"
  }).catch()

  if (response.status !== 200)
    throw new Error(`HTTP 状态码: ${response.status}`);

  const endTime = performance.now();
  const delay = Math.round(endTime - startTime);
  console.log(`当前延迟: ${delay}ms \n`);

  await options();
  return start(); // 重新开始操作
};

// 启动程序
start().catch((error) => {
  console.error("发生错误:", error);
});
