import { select, checkbox, confirm, input, number } from "@inquirer/prompts";
import { htmlToEpub } from "../htmlTo/epub.js";
import { htmlToTxt } from "../htmlTo/txt.js";
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
        description: "Epub格式小说",
      },
      {
        name: "TXT",
        value: 2,
        description: "TXT格式小说",
      },
      {
        name: "插图",
        value: 3,
        description: "仅下载插图，不下载小说",
      },
    ],
  });
  if (answer === 1) {
    await htmlToEpub(novelId);
  } else if (answer === 2) {
    await htmlToTxt(novelId);
  }
  await confirm({
    message: "小说下载完成，是否打开目录?",
    default: true,
    transformer: (value) => (value ? "YES" : "NO"),
  }).then((res) => {
    if (res) {
      // 打开目录
      exec(
        `start "" "${path.join(
          import.meta.dirname,
          `../../novels//${answer === 1 ? "epub" : "txt"}/${novel_detail.name}`
        )}"`
      );
    }
  });
};
