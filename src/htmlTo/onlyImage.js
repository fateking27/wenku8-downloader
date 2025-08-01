import { load } from "cheerio";
import path from "path";
import { imageSize } from "image-size";
import https from "https";
import url from "url";
import ora from "ora";
import { existsSync, mkdirSync } from "fs";
import {
  getNovelChapters,
  getChapterContent,
  downloadNovelImages,
} from "../download.js";
import { getBookList } from "../../src/api/index.js";
import { styleText } from "util";
import { xmlToJson } from "../../utils/xmlToJson.js";

const spinner = ora();

export const onlyImage = async (novel_id, isApp = false) => {
  spinner.start(styleText(["magenta"], "正在获取小说目录..."));

  const novelData = await new Promise((resolve, reject) => {
    if (isApp) {
      getBookList({
        list: "list",
        novel_id,
        t: new Date().getTime(),
      }).then(async (res) => {
        const result = await xmlToJson(res.data);
        const dataList = result.package.volume.map((item) => {
          const data = {};
          data.id = item.$.vid;
          data.title = item._.replace(/\n/g, "");
          data.chapter = [];
          for (const chapter of item.chapter) {
            data.chapter.push({
              id: chapter.$.cid,
              title: chapter._.replace(/\n/g, ""),
            });
          }
          return data;
        });
        console.log(dataList[0]);
      });
    } else {
      getNovelChapters(novel_id.toString()).then((res) => {
        resolve(res);
      });
    }
  });
  spinner.succeed(styleText(["magenta"], "小说目录获取成功"));

  return;

  const novelName = novelData.title.replace(/[\/:*?"<>|]/g, "？");

  const chapterVolume = novelData.chapters;
  for (const item of chapterVolume) {
    if (item.children.length) {
      const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "？"); //将名称中的特殊字符替换
      for (const chapter of item.children) {
        if (chapter.title == "插图") {
          let chapterContent = await getChapterContent(novel_id, chapter.id);
          const $ = load(chapterContent);
          const contentMain = $("#content");
          const imgList = contentMain
            .find("img")
            .map((_, imgElement) => $(imgElement).attr("src"))
            .get()
            .filter(Boolean);
          await Promise.all(
            imgList.map((url) =>
              downloadNovelImages(url, { novelName, chapterName })
            )
          );
        }
      }
    }
  }
};
