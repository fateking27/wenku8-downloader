import { select } from "@inquirer/prompts";
import { configureAccount } from "./account";
import { browseRanking } from "./lists";
import { queryNovel } from "./query";

type MenuChoice = "query" | "hot" | "new" | "updated" | "account" | "exit";

/** 主菜单；返回 false 表示用户选择退出。 */
export async function mainMenu(): Promise<boolean> {
  const answer = await select<MenuChoice>({
    message: "你打算做什么?",
    default: "query",
    choices: [
      { name: "查询小说", value: "query" },
      { name: "今日热榜", value: "hot" },
      { name: "新书风云榜", value: "new" },
      { name: "查看最近更新轻小说", value: "updated" },
      { name: "账户设置", value: "account" },
      { name: "退出", value: "exit" },
    ],
  });

  switch (answer) {
    case "query":
      await queryNovel();
      return true;
    case "hot":
      await browseRanking("hot");
      return true;
    case "new":
      await browseRanking("new");
      return true;
    case "updated":
      await browseRanking("updated");
      return true;
    case "account":
      await configureAccount();
      return true;
    case "exit":
      return false;
  }
}
