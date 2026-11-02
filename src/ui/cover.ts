import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { input } from "@inquirer/prompts";
import { line, paint, warn } from "../log";
import type { CoverPickContext } from "../types";
import { ensureDir } from "../util/fs";

function pickWithDialog(initialDir: string): string | undefined {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog;",
    `$dialog.InitialDirectory = '${initialDir.replace(/'/g, "''")}';`,
    "$dialog.Filter = '图片|*.jpg;*.jpeg;*.png;*.webp;*.gif;*.bmp|所有文件|*.*';",
    "$dialog.Title = '选择封面插图';",
    "if ($dialog.ShowDialog() -eq 'OK') { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $dialog.FileName }",
  ].join(" ");

  const result = spawnSync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    encoding: "utf8",
    timeout: 300_000,
    windowsHide: true,
  });

  return (result.stdout ?? "").trim() || undefined;
}

function validate(candidate: string | undefined, fallback: string | null): string | null {
  if (!candidate) return fallback;
  if (!existsSync(candidate)) {
    warn(`封面文件不存在：${candidate}，改用默认封面`);
    return fallback;
  }
  return candidate;
}

/**
 * 全部内容下载完成后，逐卷打开插图目录让用户选择封面。
 * Windows 使用系统文件选择框；其他平台用手动输入路径。
 */
export async function pickCoverForVolume(context: CoverPickContext): Promise<string | null> {
  ensureDir(context.imageDir);

  line();
  line(
    paint(
      "cyan",
      `【第 ${context.volumeIndex}/${context.volumeCount} 卷】${context.volumeName}`,
    ),
  );
  line(`插图目录：${context.imageDir}`);
  if (context.images.length > 0) {
    line(`本卷已下载 ${context.images.length} 张插图，可直接选用。`);
  } else {
    warn("本卷没有下载到插图，将使用默认封面");
  }
  line("文件选择框会定位到该目录，请挑选封面；取消则使用默认封面。");

  if (process.platform === "win32") {
    return validate(pickWithDialog(context.imageDir), context.defaultCover);
  }

  const answer = await input({
    message: "封面图片路径（留空使用默认封面）",
    default: "",
  });

  return validate(answer.trim().replace(/^"(.*)"$/, "$1"), context.defaultCover);
}
