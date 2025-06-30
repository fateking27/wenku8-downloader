import { select, checkbox, confirm, input, number } from "@inquirer/prompts";
import { styleText } from "util";
import Table from "cli-table3";
import ora from "ora";

import { getNovelDetail } from "../../../getNovelDetal.js";

import { novel_dl_select } from "../../novel_dl_select.js";

const spinner = ora();

export const option_1_1 = async () => {
  const answer = await number({
    message: "请输入小说ID",
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
};
