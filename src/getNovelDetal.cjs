const cheerio = require("cheerio");
const { axiosCreate, CancelToken } = require("../utils/axios.cjs");
// const wenku8Cookie = require("../../../utils/wenku8.json");
const { reqInit } = require("./request/index.cjs");
// const fs = require("fs");
// const path = require("path");

//获取小说详情
const getNovelDetail = async (novelId) => {
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
    return false;
  }

  return novel_detail;
};

module.exports = { getNovelDetail };
