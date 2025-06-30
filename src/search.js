import * as cheerio from "cheerio";
import { axiosCreate } from "../utils/axios.cjs";
import { reqInit, wenku8Login } from "./request/index.cjs";
import ora from "ora";
import { styleText } from "util";
import iconv from "iconv-lite";

const spinner = ora();

export const search = async (keyword, searchtype) => {
  let gbkBuffer = await new Promise((resolve) =>
    resolve(iconv.encode(keyword, "gbk"))
  ); // 将keyword关键字转为GBK编码的buffer
  let keywordStr = `%${gbkBuffer
    .toString("hex")
    .match(/.{1,2}/g)
    .join("%")}`; // 将GBK编码的buffer转换为符合URL编码的十六进制字符
  const url = `https://www.wenku8.net/modules/article/search.php?searchtype=${searchtype}&searchkey=${keywordStr}`;
  spinner.start(styleText("blueBright", "正在请求数据..."));
  const indexRes = await axiosCreate
    .get(url, {
      ...reqInit().config,
    })
    .catch((error) => {
      // console.log(error.stack);
    });
  if (!indexRes) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒后重试
    await wenku8Login();
    return await search();
  }
  const cookies = indexRes.headers["set-cookie"];
  if (!cookies) {
    await wenku8Login();
    return await search();
  }
  const $ = cheerio.load(reqInit(indexRes).html);
  let novelList = [];

  if ($("#centerm>#content>.grid>caption").length === 0) {
    let novel_detail = {};
    $("#content").each((index, element) => {
      novel_detail.id = indexRes.request.path.split("/")[2].split(".")[0];
      novel_detail.name = $(element)
        .find("div:eq(0)>table:eq(0) span>b")
        .text();
      novel_detail.author = $(element)
        .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(1)")
        .text()
        .split("：")[1];
      novel_detail.cover = $(element)
        .find("div:eq(0)>table:eq(1) tr>td:eq(0)>img")
        .attr("src");
      novel_detail.tags = $(element)
        .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(0)")
        .text()
        .split("：")[1];
      novel_detail.brief = $(element)
        .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(5)")
        .html()
        ? $(element).find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(5)").text()
        : $(element)
            .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(3)")
            .text();
    });

    if (!novel_detail.name) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒后重试
      await wenku8Login();
      return await search();
    }
    novelList.push(novel_detail);
    spinner.succeed(styleText("green", "数据请求成功"));
    return novelList;
  }

  $("#centerm>#content").each((_, element) => {
    novelList = $(element)
      .find(".grid td>div")
      .map((index, nov_el) => {
        return {
          id: $(nov_el)
            .find("div:eq(0)>a")
            .attr("href")
            .split("/")[2]
            .split(".")[0],
          name: $(nov_el).find("div:eq(1) b").text(),
          cover: $(nov_el).find("div:eq(0) img").attr("src"),
          author: $(nov_el).find("div:eq(1) p:eq(0)").text(),
          tags: $(nov_el)
            .find("div:eq(1) p:eq(2)>span")
            .text()
            .split(" ")
            .toString(),
          brief: $(nov_el).find("div:eq(1) p:eq(3)").text(),
        };
      })
      .get();
  });
  spinner.succeed(styleText("green", "数据请求成功"));
  return novelList;
};
