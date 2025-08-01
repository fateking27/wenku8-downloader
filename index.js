import { styleText } from "util";
import { options } from "./src/options/index.js";
console.log(
  styleText(
    "green",
    "欢迎使用wenku8轻小说文库下载器，https://github.com/fateking27/wenku8Downloader\n"
  )
);

const start = async () => {
  await options();
  await start(); // 重新开始操作
};

// 启动程序
start().catch((error) => {
  console.error("发生错误:", error);
});
