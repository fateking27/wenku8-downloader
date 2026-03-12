import { confirm, number } from "@inquirer/prompts";
import { getNovelDetail } from "../../../getNovelDetails.js";
import { novel_dl_select } from "../../novel_dl_select.js";

export const option_1_1 = async () => {
  const answer = await number({
    message: "请输入小说ID",
    validate: (input) => {
      if (isNaN(input)) {
        return "请输入数字";
      } else if (input < 0) {
        return "请输入大于0的数字";
      } else {
        return true;
      }
    },
  });

  const novel_detail = await getNovelDetail(answer);

  if (!novel_detail) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
