import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ILLEGAL_NAME_CHARS: Record<string, string> = {
  "/": "／",
  ":": "：",
  "*": "﹡",
  "?": "？",
  "<": "＜",
  ">": "＞",
  "|": "｜",
  "\\": "＼",
  '"': "＂",
};

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * 把标题转换成 Windows / macOS / Linux 都可用的文件名。
 * 与旧版行为保持一致：非法字符替换为全角字符，而不是直接删除。
 */
export function sanitizeFileName(input: string): string {
  const replaced = input.replace(/[\\/:*?"<>|]/g, (char) => ILLEGAL_NAME_CHARS[char] ?? "＿");
  const cleaned = replaced
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[. ]+$/g, "")
    .trim();

  const name = cleaned || "未命名";
  const safe = WINDOWS_RESERVED.test(name) ? `_${name}` : name;
  return safe.length > 120 ? safe.slice(0, 120).trim() : safe;
}

/** 递归创建目录（幂等）。 */
export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function pathExists(target: string): boolean {
  return existsSync(target);
}

export function isNonEmptyFile(file: string): boolean {
  try {
    return statSync(file).isFile() && statSync(file).size > 0;
  } catch {
    return false;
  }
}

export function writeFile(file: string, data: string | Uint8Array): void {
  writeFileSync(file, data);
}

/** 在系统文件管理器中打开目录。 */
export function openDirectory(dir: string): void {
  if (!existsSync(dir)) return;

  const [command, args] =
    process.platform === "win32"
      ? (["cmd", ["/c", "start", "", dir]] as const)
      : process.platform === "darwin"
        ? (["open", [dir]] as const)
        : (["xdg-open", [dir]] as const);

  const child = spawn(command, [...args], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => undefined);
  child.unref();
}

/** 展平多级目录路径（仅用于日志展示）。 */
export function relativeToRoot(target: string, root: string): string {
  const relative = path.relative(root, target);
  return relative.length === 0 ? "." : relative;
}
