import * as cheerio from "cheerio";
import { axiosCreate, CancelToken } from "../utils/axios.cjs";
import { reqInit } from "./request/index.cjs";
import ora from "ora";
import Table from "cli-table3";
import { styleText } from "util";

const spinner = ora();

//获取小说详情
export const getNovelDetail = async (novelId) => {
  spinner.start("正在获取小说信息...");
  let statusCode = null;
  const indexRes = await axiosCreate
    .get(`https://www.wenku8.net/book/${novelId}.htm`, {
      ...reqInit().config,
    })
    .catch(async (error) => {
      if (error.status == 404) {
        statusCode = 404;
      }
    });
  if (!indexRes && statusCode === 404) {
    spinner.fail(
      styleText("yellowBright", "小说不存在或获取失败，请检查ID或名称是否正确")
    );
    return false;
  } else if (!indexRes) {
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 等待10秒后重试
    return await getNovelDetail(novelId);
  }
  const $ = cheerio.load(reqInit(indexRes).html);
  let novel_detail = {};

  $("#content").each((index, element) => {
    novel_detail.id = novelId;
    novel_detail.name = $(element).find("div:eq(0)>table:eq(0) span>b").text();
    novel_detail.library_class = $(element)
      .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(0)")
      .text();
    novel_detail.author = $(element)
      .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(1)")
      .text()
      .split("：")[1];
    novel_detail.status = $(element)
      .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(2)")
      .text()
      .split("：")[1];
    novel_detail.updatetime = $(element)
      .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(3)")
      .text()
      .split("：")[1];
    novel_detail.article_length = $(element)
      .find("div:eq(0)>table:eq(0) tr:eq(2) td:eq(4)")
      .text()
      .split("：")[1];
    novel_detail.cover = $(element)
      .find("div:eq(0)>table:eq(1) tr>td:eq(0)>img")
      .attr("src");
    novel_detail.tags = $(element)
      .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(0)")
      .text()
      .split("：")[1];
    // .split(" ")
    // .join(",");
    novel_detail.latest_chapter = $(element)
      .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(5)")
      .text()
      ? $(element).find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(3)").text()
      : "";
    novel_detail.brief = $(element)
      .find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(5)")
      .html()
      ? $(element).find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(5)").text()
      : $(element).find("div:eq(0)>table:eq(1) tr>td:eq(1)>span:eq(3)").text();
  });

  if (!novel_detail.name) {
    spinner.fail(
      styleText("yellowBright", "小说不存在或获取失败，请检查ID或名称是否正确")
    );
    return false;
  }
  spinner.succeed(styleText("green", "小说详情获取成功"));
  console.log(`简介：${novel_detail.brief}`);
  const table = new Table({
    head: [
      "小说名",
      "作者",
      "标签",
      "状态",
      "更新时间",
      "全文字数",
      "最新章节",
    ],
    style: {
      head: ["red"],
      border: ["green"],
    },
    truncate: "...",
  });

  //输出table表格
  table.push([
    novel_detail.name,
    novel_detail.author,
    novel_detail.tags,
    novel_detail.status,
    novel_detail.updatetime,
    novel_detail.article_length,
    novel_detail.latest_chapter,
  ]);

  console.log(table.toString());

  if (
    !novel_detail.article_length &&
    !novel_detail.latest_chapter &&
    !novel_detail.updatetime
  ) {
    spinner.warn(
      styleText(
        "yellowBright",
        "文库已下架该小说，暂不支持下载已下架的小说内容，请等待后续更新\n"
      )
    );
    return;
  }

  return novel_detail;
};
