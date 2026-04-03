import { readdirSync, statSync, mkdirSync, rmSync, copyFileSync } from "fs";

/**
 * 混拷贝目录
 * @param {string} src 源目录
 * @param {string} dest 目标目录
 */
export const copyDirectory = (src, dest) => {
  if (!statSync(src).isDirectory()) return;

  // 清空目标目录
  if (statSync(dest, { throwIfNoEntry: false })) {
    rmSync(dest, { recursive: true, force: true });
  }

  mkdirSync(dest, { recursive: true });

  const files = readdirSync(src);
  for (const file of files) {
    const srcPath = `${src}/${file}`;
    const destPath = `${dest}/${file}`;

    if (statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};
