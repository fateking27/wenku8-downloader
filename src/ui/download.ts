import { checkbox, confirm, select } from "@inquirer/prompts";
import { getCatalog } from "../domain/catalog";
import { exportEpub } from "../export/epub";
import { exportImages } from "../export/images";
import { exportTxt } from "../export/txt";
import { errorMessage, fail, line, paint, start, succeed } from "../log";
import type { Catalog, ExportResult, NovelDetail } from "../types";
import { openDirectory } from "../util/fs";
import { pickCoverForVolume } from "./cover";

type DownloadFormat = "epub" | "txt" | "images" | "cancel";
type DownloadScope = "all" | "custom";

function report(result: ExportResult): void {
  line(`\n${paint("greenBright", `输出目录：${result.dir}`)}`);
  line(`新建 ${result.files.length} 个文件，跳过 ${result.skipped} 个，失败 ${result.failed.length} 条`);

  for (const item of result.failed.slice(0, 10)) {
    line(`  - ${item}`);
  }
  if (result.failed.length > 10) {
    line(`  …… 其余 ${result.failed.length - 10} 条`);
  }
}

export async function downloadMenu(detail: NovelDetail): Promise<void> {
  const format = await select<DownloadFormat>({
    message: "请选择下载格式",
    default: "epub",
    choices: [
      { name: "Epub", value: "epub", description: "带封面、插图和目录的电子书" },
      { name: "TXT", value: "txt", description: "纯文本，按分卷保存" },
      { name: "插图", value: "images", description: "仅下载封面与插图" },
      { name: "取消", value: "cancel", description: "返回主菜单" },
    ],
  });

  if (format === "cancel") return;

  start("正在获取小说目录…");
  let catalog: Catalog;
  try {
    catalog = await getCatalog(detail);
  } catch (error) {
    fail(errorMessage(error));
    return;
  }
  succeed("小说目录获取成功");

  const scope = await select<DownloadScope>({
    message: "请选择下载范围",
    default: "all",
    choices: [
      { name: "全卷下载", value: "all" },
      { name: "自定义分卷下载（多选）", value: "custom" },
    ],
  });

  let volumes = catalog.volumes;
  if (scope === "custom") {
    const selected = await checkbox<string>({
      message: "请选择要下载的分卷",
      instructions: "（空格选择，Enter 确认）",
      choices: volumes.map((volume) => ({
        name: `${volume.name}（${volume.chapters.length} 章）`,
        value: volume.id,
      })),
      pageSize: 12,
      loop: false,
    });

    volumes = volumes.filter((volume) => selected.includes(volume.id));
    if (volumes.length === 0) {
      fail("未选择任何分卷");
      return;
    }
  }

  let result: ExportResult;

  try {
    switch (format) {
      case "epub": {
        const customCover = await confirm({
          message: "是否自定义插图？（全部内容下载完成后，逐卷选择封面）",
          default: false,
          transformer: (value) => (value ? "YES" : "NO"),
        });

        result = await exportEpub(
          detail,
          catalog,
          volumes,
          customCover ? { pickCover: pickCoverForVolume } : {},
        );
        break;
      }
      case "txt":
        result = await exportTxt(detail, catalog, volumes);
        break;
      case "images":
        result = await exportImages(detail, catalog, volumes);
        break;
    }
  } catch (error) {
    fail(`导出失败：${errorMessage(error)}`);
    return;
  }

  if (result.files.length === 0 && result.skipped === 0) {
    fail("没有生成任何文件");
    return;
  }

  report(result);
  line(paint("greenBright", `小说《${detail.name}》下载完毕，请在上方目录中查看`));

  const shouldOpen = await confirm({
    message: "是否打开目录?",
    default: true,
    transformer: (value) => (value ? "YES" : "NO"),
  });
  if (shouldOpen) openDirectory(result.dir);
}
