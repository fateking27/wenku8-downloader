import {
  select,
  checkbox,
  confirm,
  input,
  number,
  rawlist,
} from "@inquirer/prompts";
import { styleText } from "util";
import Table from "cli-table3";

import { getUpdateNovelList } from "../../getUpdateNovelList.js";
import { getNovelDetail } from "../../getNovelDetal.js";
import { novel_dl_select } from "../novel_dl_select.js";

export const option_4 = async () => {
  const data = await getUpdateNovelList();
  if (data) {
    data.forEach((item) => {
      item.value = item.id;
      item.name += `  ${item.author_uptime}`;
    });

    const answer = await select({
      message: "请选择",
      choices: data,
      pageSize: 15,
      loop: false,
    });
    const novel_detail = await getNovelDetail(answer);
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
  }
};
