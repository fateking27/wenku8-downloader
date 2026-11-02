import { styleText } from "node:util";
import ora from "ora";
import type { Ora } from "ora";

/** 全局共享一个 spinner，避免多处同时输出互相覆盖。 */
export const spinner: Ora = ora();

export type Style = Parameters<typeof styleText>[0];

export function paint(style: Style, text: string): string {
  return styleText(style, text);
}

export function banner(version: string): void {
  console.log(
    paint(
      "green",
      `欢迎使用 wenku8 轻小说文库下载器 v${version}，https://github.com/fateking27/wenku8-downloader\n`,
    ),
  );
}

export function start(message: string): void {
  spinner.start(message);
}

export function succeed(message: string): void {
  spinner.succeed(message);
}

export function fail(message: string): void {
  spinner.fail(message);
}

export function warn(message: string): void {
  writeAboveSpinner(paint("yellowBright", `⚠ ${message}`));
}

export function info(message: string): void {
  writeAboveSpinner(paint("cyan", `ℹ ${message}`));
}

/**
 * 在 spinner 上方输出一行提示，然后恢复等待状态。
 * `spinner.warn()` 会停止 spinner，导致后续请求看起来“卡住”，所以这里手动处理。
 */
function writeAboveSpinner(text: string): void {
  const wasSpinning = spinner.isSpinning;
  const currentText = spinner.text;

  if (wasSpinning) spinner.stop();
  console.log(text);
  if (wasSpinning) spinner.start(currentText);
}

export function stop(): void {
  if (spinner.isSpinning) spinner.stop();
}

export function line(message = ""): void {
  console.log(message);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
