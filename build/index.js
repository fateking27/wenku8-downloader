import { styleText } from "util";
import {
  existsSync,
  writeFileSync,
} from "fs";
import path from "path";
import { copyDirectory } from "./copyDirectory.js";

// function copyDirectory(src, dest) {
//   if (!statSync(src).isDirectory()) return;

//   if (!statSync(dest, { throwIfNoEntry: false })) {
//     mkdirSync(dest, { recursive: true });
//   }

//   const files = readdirSync(src);
//   for (const file of files) {
//     const srcPath = `${src}/${file}`;
//     const destPath = `${dest}/${file}`;

//     if (statSync(srcPath).isDirectory()) {
//       copyDirectory(srcPath, destPath);
//     } else {
//       copyFileSync(srcPath, destPath);
//     }
//   }
// }

const Plugin = {
  name: "plugin",
  setup(build) {
    build.onEnd((result) => {
      console.log(`构建完成，输出了 ${result.outputs.length} 个文件：`);

      if (!existsSync(path.join(process.cwd(), "/dist/wenku8.json"))) {
        writeFileSync(
          path.join(process.cwd(), "/dist/wenku8.json"),
          JSON.stringify({ cookie: "" }),
          {
            encoding: "utf-8",
          },
        );
      }

      const outputDir = "./dist";
      // 源目录和目标目录的映射关系
      const dirList = [
        {
          src_dir: "./node_modules/@lesjoursfr",
          dest_dir: [`${outputDir}/@lesjoursfr`],
        },
        { src_dir: "./assets", dest_dir: [`${outputDir}/assets`] },
      ];

      dirList.forEach((dir) => {
        dir.dest_dir.forEach((dest) => {
          console.log(`正在复制目录：${dir.src_dir} 到 ${dest}`);
          copyDirectory(dir.src_dir, dest);
          console.log(`目录复制完成：${dir.src_dir} 到 ${dest}`);
        });
      });
    });
  },
};

const config = {
  entrypoints: ["./index.js"],
  compile: {
    outfile: "./dist/wenku8-downloader",
    windows: {
      version: "1.0",
      publisher: "fateking27",
      copyright: "Copyright (c) 2026 fateking27. All rights reserved.",
      description: "wenku8-downloader built with Bun.",
      icon: "./assets/wenku8.ico",
    },
  },
  minify: true,
  sourcemap: "linked",
  // bytecode: true,
  plugins: [Plugin],
};

const result = await Bun.build(config);

if (result.success) {
  result.outputs.forEach((output) => {
    console.log(styleText(["greenBright"], `${output.path}`));
  });
}
