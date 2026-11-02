import { confirm } from "@inquirer/prompts";
import { getNovelDetail } from "../domain/detail";
import { errorMessage, fail, start, succeed } from "../log";
import { downloadMenu } from "./download";
import { printNovelDetail } from "./table";

/** 统一的“查询详情 → 确认 → 选择下载方式”流程。 */
export async function startDownloadFlow(novelId: string): Promise<void> {
  start("正在获取小说详情…");

  let detail;
  try {
    detail = await getNovelDetail(novelId);
  } catch (error) {
    fail(`获取小说详情失败：${errorMessage(error)}`);
    return;
  }

  if (!detail) {
    fail(`未获取到小说详情：${novelId}`);
    return;
  }

  succeed("小说详情获取成功");
  printNovelDetail(detail);

  const shouldDownload = await confirm({
    message: "是否下载该小说?",
    default: true,
    transformer: (value) => (value ? "YES" : "NO"),
  });
  if (!shouldDownload) {
    console.log("已取消下载");
    return;
  }

  await downloadMenu(detail);
}
