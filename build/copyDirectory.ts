import { readdirSync, statSync, mkdirSync, rmSync, copyFileSync } from "node:fs";

/**
 * 递归拷贝目录（会先清空目标目录）。
 * 用于把 EPUB 依赖的模板与静态资源放进发布目录。
 */
export function copyDirectory(source: string, destination: string): void {
  if (!statSync(source).isDirectory()) return;

  if (statSync(destination, { throwIfNoEntry: false })) {
    rmSync(destination, { recursive: true, force: true });
  }

  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source)) {
    const sourcePath = `${source}/${entry}`;
    const destinationPath = `${destination}/${entry}`;

    if (statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      copyFileSync(sourcePath, destinationPath);
    }
  }
}
