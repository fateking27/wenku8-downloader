import { select, checkbox, confirm, input, number } from "@inquirer/prompts";
import { htmlToEpub } from "../htmlTo/epub.js";
import { htmlToTxt } from "../htmlTo/txt.js";
import { onlyImage } from "../htmlTo/onlyImage.js";
import { exec } from "child_process";
import path from "path";

export const novel_dl_select = async (novelId, novel_detail) => {
  const answer = await select({
    message: "开始下载",
    default: 1,
    choices: [
      {
        name: "Epub",
        value: 1,
        description: "Epub格式",
      },
      {
        name: "TXT",
        value: 2,
        description: "TXT格式",
      },
      {
        name: "插图",
        value: 3,
        description: "仅下载插图",
      },
      {
        name: "取消",
        value: 4,
        description: "取消下载",
      },
    ],
  });
  // await select({
  //   message: "请选择",
  //   default: 1,
  //   choices: [
  //     {
  //       name: "全卷下载",
  //       value: 1,
  //     },
  //     {
  //       name: "自定义下载（多选）",
  //       value: 2,
  //     },
  //   ],
  // });
  if (answer === 1) {
    await htmlToEpub(novelId, novel_detail.app);
  } else if (answer === 2) {
    await htmlToTxt(novelId, novel_detail.app);
  } else if (answer === 3) {
    await onlyImage(novelId, novel_detail.app);
  } else if (answer === 4) {
    return;
  }
  await confirm({
    message: "下载完毕，是否打开目录?",
    default: true,
    transformer: (value) => (value ? "YES" : "NO"),
  }).then((res) => {
    if (res) {
      // 打开目录
      exec(
        `start "" "${path.join(
          import.meta.dirname,
          `../..${answer !== 3 ? "/novels" : ""}/${
            answer === 1 ? "epub" : answer === 2 ? "txt" : "插图"
          }/${novel_detail.name.replace(/[\/:*?"<>|]/g, "：")}`
        )}"`
      );
    }
  });
};
