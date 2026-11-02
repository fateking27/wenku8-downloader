#!/usr/bin/env bun
import { APP_VERSION, ensureRuntimeFiles, loadWenku8Config } from "./config";
import { proxyEnabled, proxyStatusText } from "./http/proxy";
import { banner, errorMessage, line, paint, stop } from "./log";
import { mainMenu } from "./ui/menu";

function isPromptExit(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "ExitPromptError"
  );
}

function printEnvironment(): void {
  const proxy = proxyStatusText();
  line(`代理：${proxyEnabled() ? paint("green", proxy) : paint("yellow", proxy)}`);

  const config = loadWenku8Config();
  const account = config.username || process.env.WENKU8_USERNAME || "";
  line(`账号：${account ? paint("green", account) : paint("yellow", "未配置（可在“账户设置”中填写）")}`);
  line(`Cookie：${config.cookie ? paint("green", "已配置") : paint("yellow", "未配置（部分内容需要登录）")}`);

  line();
}

async function main(): Promise<void> {
  ensureRuntimeFiles();
  banner(APP_VERSION);
  printEnvironment();

  for (;;) {
    try {
      const shouldContinue = await mainMenu();
      if (!shouldContinue) break;
    } catch (error) {
      if (isPromptExit(error)) break;
      throw error;
    }
    line();
  }
}

main().catch((error: unknown) => {
  stop();
  if (isPromptExit(error)) return;
  console.error(paint("redBright", `发生错误：${errorMessage(error)}`));
  process.exitCode = 1;
});
