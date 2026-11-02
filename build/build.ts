import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BunPlugin } from "bun";
import { paint } from "../src/log";
import { copyDirectory } from "./copyDirectory";
import { createTarGz } from "./createArchive";

const OUTPUT_DIR = path.join(process.cwd(), "dist");
const ROOT = process.cwd();

const packageJson = (await Bun.file(path.join(ROOT, "package.json")).json()) as {
  version?: string;
};
const VERSION = packageJson.version ?? "0.0.0";

const DEFAULT_PROXY_CONFIG = {
  proxy: false,
  noProxyUrls: [
    "pic.777743.xyz",
    "img.wenku8.com",
    "www.wenku8.net/login.php",
    "www.wenku8.net/index.php",
    "www.wenku8.net/modules/article/search.php",
    "www.wenku8.net/book",
    "wenku8-relay.mewx.org",
  ],
  proxyList: [],
};

function writeJsonIfMissing(file: string, data: unknown): void {
  if (existsSync(file)) return;
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const copyAssetsPlugin: BunPlugin = {
  name: "copy-assets",
  setup(build) {
    build.onEnd((result) => {
      console.log(`构建完成，输出了 ${result.outputs.length} 个文件`);

      writeJsonIfMissing(path.join(OUTPUT_DIR, "wenku8.json"), { cookie: "" });
      writeJsonIfMissing(path.join(OUTPUT_DIR, "proxy.config.json"), DEFAULT_PROXY_CONFIG);

      const copies: [string, string][] = [
        [path.join(ROOT, "node_modules/@lesjoursfr"), path.join(OUTPUT_DIR, "@lesjoursfr")],
        [path.join(ROOT, "assets"), path.join(OUTPUT_DIR, "assets")],
      ];

      for (const [source, destination] of copies) {
        if (!existsSync(source)) continue;
        console.log(`正在复制目录：${source} → ${destination}`);
        copyDirectory(source, destination);
      }
    });
  },
};

const result = await Bun.build({
  entrypoints: ["./src/main.ts"],
  compile: {
    outfile: "./dist/wenku8-downloader",
    windows: {
      version: VERSION,
      publisher: "fateking27",
      copyright: "Copyright (c) 2026 fateking27. All rights reserved.",
      description: "wenku8-downloader built with Bun.",
      icon: "./assets/wenku8.ico",
    },
  },
  minify: true,
  plugins: [copyAssetsPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

for (const output of result.outputs) {
  console.log(paint("greenBright", output.path));
}

// 可执行文件与运行所需资源都就绪后，再打包成最小体积的 tar.gz。
const archivePath = path.join(OUTPUT_DIR, `wenku8-downloader-v${VERSION}.tar.gz`);

try {
  const archive = await createTarGz(OUTPUT_DIR, archivePath);
  console.log(paint("greenBright", `压缩包：${archivePath}`));
  console.log(`共 ${archive.entries} 个文件，${formatBytes(archive.bytes)}`);
} catch (error) {
  console.error(`创建压缩包失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
