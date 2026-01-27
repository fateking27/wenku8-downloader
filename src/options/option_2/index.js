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

import { getHotNovelList } from "../../getHotNovelList.js";
import { getNovelDetail } from "../../getNovelDetails.js";
import { novel_dl_select } from "../novel_dl_select.js";

export const option_2 = async () => {
  const data = await getHotNovelList();
  if (data) {
    data.forEach((item) => {
      item.value = item.id;
    });

    const answer = await rawlist({
      message: "请选择",
      choices: data,
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
