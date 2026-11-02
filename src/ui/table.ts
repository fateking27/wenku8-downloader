import Table from "cli-table3";
import { paint } from "../log";
import type { NovelDetail } from "../types";

/** 以表格形式打印小说详情。 */
export function printNovelDetail(detail: NovelDetail): void {
  const table = new Table({
    head: ["ID", "小说名", "作者", "标签", "状态", "更新时间", "全文字数", "最新章节"],
    style: {
      head: ["red"],
      border: ["green"],
    },
    truncate: "...",
  });

  table.push([
    detail.id,
    detail.name,
    detail.author || "-",
    detail.tags || "-",
    detail.status || "-",
    detail.updateTime || "-",
    detail.wordCount || "-",
    detail.latestChapter || "-",
  ]);

  console.log(table.toString());
  console.log(`${paint(["red", "bold"], "简介：")}${detail.brief || "（无）"}\n`);
}
