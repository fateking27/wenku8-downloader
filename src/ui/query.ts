import { input, number, rawlist, select } from "@inquirer/prompts";
import { searchNovels } from "../domain/discover";
import { fail, start, succeed, warn } from "../log";
import type { NovelSummary } from "../types";
import { startDownloadFlow } from "./flow";

type QueryMode = "id" | "title" | "author";

async function pickNovel(items: readonly NovelSummary[]): Promise<string | null> {
  const choices = items.map((item) => ({
    name: `${item.name}${item.author ? ` — ${item.author}` : ""}${item.extra ? `  ${item.extra}` : ""}`,
    value: item.id,
  }));

  const id = await rawlist<string>({
    message: "请选择",
    choices,
    loop: false,
  });

  return id || null;
}

export async function queryNovel(): Promise<void> {
  const mode = await select<QueryMode>({
    message: "查询方式",
    default: "id",
    choices: [
      { name: "ID查询", value: "id" },
      { name: "小说标题查询", value: "title" },
      { name: "作者名称查询", value: "author" },
    ],
  });

  if (mode === "id") {
    const id = await number({
      message: "请输入小说ID",
      validate: (value) => {
        if (value === undefined || Number.isNaN(value)) return "请输入数字";
        if (!Number.isInteger(value) || value <= 0) return "请输入大于 0 的整数";
        return true;
      },
    });

    if (id === undefined || Number.isNaN(id)) {
      warn("请输入有效的小说 ID");
      return;
    }

    await startDownloadFlow(String(id));
    return;
  }

  const keyword = await input({
    message: mode === "title" ? "请输入小说标题" : "请输入作者名称",
    validate: (value) => (value.trim().length > 0 ? true : "不能为空"),
  });

  start("正在请求数据…");
  const results = await searchNovels(keyword, mode === "title" ? "articlename" : "author");
  if (results.length === 0) {
    fail("未找到相关小说");
    return;
  }
  succeed("数据请求成功");

  const selected = await pickNovel(results);
  if (selected) await startDownloadFlow(selected);
}
