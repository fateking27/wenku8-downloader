import { load } from "cheerio";
import { checkbox } from "@inquirer/prompts";
import ora from "ora";
import {
  getNovelChapters,
  getChapterContent,
  downloadNovelImages,
} from "../download.js";
import { getBookList, getBookMeta, getBookText } from "../../src/api/index.js";
import { styleText } from "util";
import { xmlToJson } from "../../utils/xmlToJson.js";

const spinner = ora();
const novel_detail = async (novelId) => {
  const novelDetail = {};
  await getBookMeta({
    meta: "meta",
    novel_id: novelId,
    t: "0",
  }).then(async (res) => {
    const result = await xmlToJson(res.data);
    result.metadata.data.forEach((item) => {
      if (item.$.name === "BookLength") {
        novelDetail.article_length = item.$.value;
      } else if (item.$.name === "LastUpdate") {
        novelDetail.updatetime = item.$.value;
      } else if (item.$.name === "LatestSection") {
        novelDetail.latest_chapter = item._;
      } else if (item.$.name === "Title") {
        novelDetail.title = item._;
      } else if (item.$.name === "Author") {
        novelDetail.author = item.$.value;
      } else if (item.$.name === "Tags") {
        novelDetail.tags = item.$.value;
      } else if (item.$.name === "PressId") {
        novelDetail.press_id = item.$.value;
      }
    });
  });
  return novelDetail;
};

export const onlyImage = async (novel_id, isApp = false, dlType) => {

  spinner.start(styleText(["magenta"], "正在获取小说目录..."));
  const novelDetail = await novel_detail(novel_id);
  const novelData = await new Promise((resolve, reject) => {
    if (isApp) {
      getBookList({
        list: "list",
        novel_id,
        t: new Date().getTime(),
      })
        .then(async (res) => {
          const result = await xmlToJson(res.data);
          const dataList = result.package.volume.map((item) => {
            const data = {};
            data.id = item.$.vid;
            data.chapter = item._.replace(/\n/g, "");
            data.children = [];
            for (const chapter of item.chapter) {
              data.children.push({
                id: chapter.$.cid,
                title: chapter._.replace(/\n/g, ""),
              });
            }
            return data;
          });
          resolve({
            title: novelDetail.title,
            author: novelDetail.author,
            chapters: dataList,
          });
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      getNovelChapters(novel_id.toString())
        .then((res) => {
          resolve(res);
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
  spinner.succeed(styleText(["magenta"], "小说目录获取成功"));

  const novelName = novelData.title.replace(/[\/:*?"<>|]/g, "？");

  let chapterVolume = novelData.chapters;

  if (dlType === "custom") {
    const checkValue = await checkbox({
      message: "请选择要下载的分卷",
      instructions: "（使用空格选择，Enter确认）",
      choices: chapterVolume.map((item) => ({
        name: item.chapter,
        value: item.id,
      })),
      pageSize: 10,
      loop: false,
    });
    chapterVolume = chapterVolume.filter((item) =>
      checkValue.includes(item.id)
    );
  }

  if (isApp) {
    for (const item of chapterVolume) {
      if (item.children.length) {
        const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "："); //将名称中的特殊字符替换
        for (const chapter of item.children) {
          if (chapter.title == "插图") {
            const res = await getBookText({
              novel_id,
              chapter_id: chapter.id,
            });

            const text = res.data.replace(/[\u4e00-\u9fa5]/g, ""); //去除所有中文字符
            // 提取所有图片URL
            const regex = /<!--image-->(.*?)<!--image-->/g;
            const imgList = Array.from(
              text.matchAll(regex),
              (match) => match[1]
            );
            await Promise.all(
              imgList.map((url) =>
                downloadNovelImages(url, { novelName, chapterName })
              )
            );
          }
        }
      }
    }
  } else {
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
  }
};
