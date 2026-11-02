import { rawlist } from "@inquirer/prompts";
import { getRanking } from "../domain/discover";
import { errorMessage, fail, start, succeed } from "../log";
import type { RankingKind } from "../types";
import { startDownloadFlow } from "./flow";

const TITLES: Readonly<Record<RankingKind, string>> = {
  hot: "今日热榜",
  new: "新书风云榜",
  updated: "最近更新",
};

export async function browseRanking(kind: RankingKind): Promise<void> {
  start(`正在请求${TITLES[kind]}数据…`);

  let items;
  try {
    items = await getRanking(kind);
  } catch (error) {
    fail(`${TITLES[kind]}获取失败：${errorMessage(error)}`);
    return;
  }

  if (items.length === 0) {
    fail(`${TITLES[kind]}没有数据`);
    return;
  }
  succeed("数据请求成功");

  const selected = await rawlist<string>({
    message: TITLES[kind],
    choices: items.map((item) => ({
      name: `${item.name}${item.extra ? `  ${item.extra}` : ""}`,
      value: item.id,
    })),
    loop: false,
  });

  if (selected) await startDownloadFlow(selected);
}
