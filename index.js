import { styleText } from "util";
import { options } from "./src/options/index.js";
console.log(
  styleText(
    "green",
    "欢迎使用wenku8轻小说文库下载器，https://github.com/fateking27/wenku8Downloader\n"
  )
);

import axios from "axios";
import xml2js from "xml2js";

const start = async () => {

  // await axios
  //   .post(
  //     "http://app.wenku8.com/android.php",
  //     {
  //       // timetoken: "1751792209505",
  //       appver: "1.21",
  //       request: "YWN0aW9uPWJvb2smZG89bGlzdCZhaWQ9MzEwMyZ0PTA=",
  //     },
  //     {
  //       headers: {
  //         "User-Agent":
  //           "Dalvik/2.1.0 (Linux; U; Android 15; V2425A Build/AP3A.240905.015.A2_V000L1)",
  //         "Accept-Encoding": "gzip",
  //         "Accept-Language": "zh-CN,zh;q=0.9",
  //         "Cache-Control": "max-age=0",
  //         Connection: "keep-alive",
  //         "Content-Type": "application/x-www-form-urlencoded",
  //         // Cookie: "PHPSESSID=a967bda1a724fc8dd8f4eed1d8b32e8f",
  //         Host: "app.wenku8.com",
  //       },
  //     }
  //   )
  //   .then((res) => {
  //     // console.log(res.data);
  //     const parser = new xml2js.Parser();
  //     parser.parseString(res.data, (err, result) => {
  //       if (err) {
  //         console.error("XML解析错误:", err);
  //       } else {
  //         // console.log("XML解析结果:", result.package.volume[0].chapter);
  //         const dataList = result.package.volume.map((item) => {
  //           const data = {};
  //           data.id = item.$.vid;
  //           data.title = item._.replace(/\n/g, "");
  //           data.chapter = [];
  //           for (const chapter of item.chapter) {
  //             data.chapter.push({
  //               id: chapter.$.cid,
  //               title: chapter._.replace(/\n/g, ""),
  //             });
  //           }
  //           return data;
  //         });
  //         console.log(dataList[0]);
  //       }
  //     });
  //   });
  
  await options();
  await start(); // 重新开始操作
};

// 启动程序
start().catch((error) => {
  console.error("发生错误:", error);
});
