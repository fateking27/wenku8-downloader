import { confirm, input, rawlist } from "@inquirer/prompts";
import { styleText } from "util";
import ora from "ora";

import { getNovelDetail } from "../../../getNovelDetal.js";
import { search } from "../../../search.js";

import { novel_dl_select } from "../../novel_dl_select.js";

const spinner = ora();

export const option_1_3 = async () => {
  const answer = await input({
    message: "请输入作者名称",
    validate: (value) => {
      if (!value) {
        return "作者名称不能为空";
      }
      return true;
    },
  });

  const data = await search(answer, "author");

  if (data.length) {
    data.forEach((item) => {
      item.value = item.id;
    });

    const answer = await rawlist({
      message: "请选择",
      choices: data,
    });
    const novel_detail = await getNovelDetail(answer);
    if (!novel_detail) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return;
    }
    await confirm({
      message: "是否下载该小说?",
      default: true,
      transformer: (value) => (value ? "YES" : "NO"),
    }).then(async (res) => {
      if (res) {
        await novel_dl_select(answer, novel_detail);
      } else {
        console.log("已取消下载");
      }
    });
  } else {
    spinner.fail(styleText("red", "未找到相关小说"));
  }
};
