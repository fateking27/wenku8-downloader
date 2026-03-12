import { styleText } from "util";
import {
  readdirSync,
  statSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  existsSync,
  writeFileSync,
} from "fs";
import path from "path";

function copyDirectory(src, dest) {
  if (!statSync(src).isDirectory()) return;

  if (!statSync(dest, { throwIfNoEntry: false })) {
    mkdirSync(dest, { recursive: true });
  }

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
}

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

      // 拷贝 assets 文件夹到打包目录
      const assetsDir = "./assets";
      const outputDir = "./dist";

      try {
        if (statSync(assetsDir, { throwIfNoEntry: false })) {
          const destAssetsDir = `${outputDir}/assets`;

          // 清空目标目录
          if (statSync(destAssetsDir, { throwIfNoEntry: false })) {
            rmSync(destAssetsDir, { recursive: true, force: true });
          }

          mkdirSync(destAssetsDir, { recursive: true });
          copyDirectory(assetsDir, destAssetsDir);
          // console.log(styleText(["greenBright"], `${destAssetsDir}`));
        }
      } catch (error) {
        // console.log(styleText(["red"], `拷贝 assets 文件夹时出错: ${error.message}`));
      }
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
      icon: "./assets/wenku8.ico"
    },
  },
  minify: true,
  sourcemap: "linked",
  bytecode: true,
  plugins: [Plugin]
};

const result = await Bun.build(config);

if (result.success) {
  result.outputs.forEach((output) => {
    console.log(styleText(["greenBright"], `${output.path}`));
  });
}
