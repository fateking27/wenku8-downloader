import { htmlToText } from "html-to-text";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { getNovelChapters, getChapterContent } from "../download.js";
import { getBookText } from "../api/index.js";
import { styleText } from "util";
import ora from "ora";
import { checkbox } from "@inquirer/prompts";

const __dirname = import.meta.dirname; // 获取当前文件路径
const spinner = ora();

const htmlToTxt = async (novel_id, isApp, dlType) => {
  spinner.start(styleText(["magenta"], "正在获取小说目录..."));
  const novelData = await getNovelChapters(novel_id.toString());
  spinner.succeed(styleText(["magenta"], "小说目录获取成功"));

  // const novelName = novelData.title.replace(/[\/:*?"<>|]/g, "：");
  const novelName = novelData.title.replace(/[\/:*?"<>|]/g, (match) => {
    switch (match) {
      case "/":
        return "";
      case ":":
        return "：";
      case "*":
        return "_";
      case "?":
        return "？";
      case "<":
        return "_";
      case ">":
        return "_";
      case "|":
        return "_";
    }
  });

  //递归创建多级目录
  const mkdirsSync = async (dirname) => {
    if (existsSync(dirname)) {
      return true;
    } else {
      if (mkdirsSync(path.dirname(dirname))) {
        mkdirSync(dirname);
        return true;
      }
    }
  };

  const txtDirPath = path.join(
    __dirname,
    `../../novels/txt/${novelName}` // 使用小说名称作为目录名
  );
  await mkdirsSync(txtDirPath); // 如果目录不存在，则创建目录

  //分卷写入
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

  for (const item of chapterVolume) {
    if (item.children.length) {
      //将名称中的特殊字符替换
      // const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "：");
      const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, (match) => {
        switch (match) {
          case "/":
            return "";
          case ":":
            return "：";
          case "*":
            return "_";
          case "?":
            return "？";
          case "<":
            return "_";
          case ">":
            return "_";
          case "|":
            return "_";
        }
      });
      
      for (const chapter of item.children) {
        if (chapter.title == "插图") {
          continue;
        }
        spinner.start(
          "开始下载：" +
            styleText(["magenta"], `${item.chapter}、${chapter.title}`)
        );
        const html = isApp ? "" : await getChapterContent(novel_id, chapter.id);
        if (!html && !isApp) {
          spinner.fail(
            styleText(["red"], `章节内容不存在: ${chapter.id}.${chapter.title}`)
          );
          continue;
        }
        const text = isApp
          ? await getBookText({ novel_id, chapter_id: chapter.id }).then(
              (res) => res.data
            )
          : htmlToText(html, {
              wordwrap: 130,
              ignoreHref: true,
              ignoreImage: true,
              selectors: [
                {
                  selector: "#contentdp",
                  format: "skip",
                },
              ],
            });
        writeFileSync(`${txtDirPath}/${chapterName}.txt`, `\n\n${text}\n`, {
          flag: "a", //追加写入
          encoding: "utf-8",
        });
        spinner.succeed(
          "下载完成：" +
            styleText(["magenta"], `${item.chapter}、${chapter.title}`)
        );
      }
    }
  }
  spinner.succeed(
    styleText(
      ["greenBright"],
      "小说《" + novelName + "》下载完毕" + "，请在novels/txt目录下查看"
    )
  );
};

export { htmlToTxt };
