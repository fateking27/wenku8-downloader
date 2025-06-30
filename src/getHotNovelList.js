import * as cheerio from "cheerio";
import { axiosCreate } from "../utils/axios.cjs";
import { reqInit, wenku8Login } from "./request/index.cjs";
import ora from "ora";
import { styleText } from "util";

const spinner = ora();

export const getHotNovelList = async () => {
  spinner.start(styleText("blueBright", "正在请求今日热榜数据..."));
  const indexRes = await axiosCreate
    .get(`https://www.wenku8.net/index.php`, {
      ...reqInit().config,
    })
    .catch((error) => {
      // console.log(error.stack);
    });
  if (!indexRes) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒后重试
    await wenku8Login();
    return await getHotNovelList();
  }
  const cookies = indexRes.headers["set-cookie"];
  if (!cookies) {
    await wenku8Login();
    return await getHotNovelList();
  }
  const $ = cheerio.load(reqInit(indexRes).html);
  const novelList = [];
  $("#right .block:eq(0)>.blockcontent")
    .find("li")
    .each((_, element) => {
      const novel = {};
      novel.id = $(element).find("a").attr("href").split("/")[2].split(".")[0];
      novel.name = $(element).find("a").attr("title");
      novelList.push(novel);
    });
  if (novelList.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒后重试
    await wenku8Login();
    return await getHotNovelList();
  }
  spinner.succeed(styleText(["green"], "数据请求成功"));
  return novelList;
};
