import { getNovelChapters } from "../download.js";
import { styleText } from "util";
import ora from "ora";
import axios from "axios";
import path from "path";
import fs from "fs";
import { checkbox } from "@inquirer/prompts";

const spinner = ora();

export const onlyTxt = async (novel_id, dlType) => {
  spinner.start(styleText(["magenta"], "正在获取小说目录..."));
  const novelChapterData = await getNovelChapters(novel_id.toString());
  spinner.succeed(styleText(["magenta"], "小说目录获取成功"));

  // console.log(novelChapterData);

  const novelName = novelChapterData.title.replace(/[\/:*?"<>|]/g, (match) => {
    switch (match) {
      case "/":
        return "／";
      case ":":
        return "：";
      case "*":
        return "﹡";
      case "?":
        return "？";
      case "<":
        return "＜";
      case ">":
        return "＞";
      case "|":
        return "｜";
    }
  });

  //递归创建多级目录
  const mkdirsSync = async (dirname) => {
    if (fs.existsSync(dirname)) {
      return true;
    } else {
      if (mkdirsSync(path.dirname(dirname))) {
        fs.mkdirSync(dirname);
        return true;
      }
    }
  };

  const txtDirPath = path.join(
    process.cwd(),
    `/novels/txt/${novelName}`, // 使用小说名称作为目录名
  );
  await mkdirsSync(txtDirPath); // 如果目录不存在，则创建目录
  //分卷下载
  let chapterVolume = novelChapterData.chapters;

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
      checkValue.includes(item.id),
    );
  }

  for (const item of chapterVolume) {
    spinner.start(styleText(["magenta"], `正在下载${item.chapter}...`));

    if (fs.existsSync(path.join(txtDirPath, `${item.chapter}.txt`))) {
      spinner.succeed(
        styleText(
          ["greenBright"],
          `《${item.chapter}》已下载，请在novels/txt目录下查看`,
        ),
      );
      continue;
    }

    const res = await axios.get(
      `https://dl.wenku8.com/packtxt.php?aid=${novel_id}&vid=${item.id}`,
      {
        responseType: "stream",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
      },
    );
    const txtStream = fs.createWriteStream(
      path.join(txtDirPath, `${item.chapter}.txt`),
    );
    res.data.pipe(txtStream);
    txtStream.on("error", (err) => {
      spinner.fail(
        styleText(["red"], `下载${item.chapter}时出错: ${err.message}`),
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    spinner.succeed(
      "下载完成：" + styleText(["magenta"], `${novelName}、${item.chapter}`),
    );
  }
  spinner.succeed(
    styleText(
      ["greenBright"],
      "小说《" + novelName + "》下载完毕" + "，请在novels/txt目录下查看",
    ),
  );
};
