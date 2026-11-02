import {
  createReadStream,
  createWriteStream,
  readdirSync,
  statSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { constants, createGzip, type Gzip } from "node:zlib";

export interface ArchiveResult {
  file: string;
  entries: number;
  bytes: number;
}

interface ArchiveFile {
  absolutePath: string;
  archivePath: string;
  stat: Stats;
}

const TAR_BLOCK = 512;

function toArchivePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/").replace(/^\.\/+/, "");
}

function isArchiveFile(name: string): boolean {
  return /\.(?:tar\.gz|tgz|gz|zip)$/i.test(name);
}

function collectFiles(rootDir: string, outputFile: string): ArchiveFile[] {
  const outputResolved = path.resolve(outputFile);
  const files: ArchiveFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (path.resolve(absolutePath) === outputResolved) continue;
      if (isArchiveFile(entry.name)) continue;

      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          absolutePath,
          archivePath: toArchivePath(path.relative(rootDir, absolutePath)),
          stat: statSync(absolutePath),
        });
      }
    }
  };

  walk(rootDir);
  return files.sort((left, right) => left.archivePath.localeCompare(right.archivePath));
}

/** tar 的 name 字段只有 100 字节，超长路径要拆到 prefix 字段。 */
function splitTarName(name: string): { name: string; prefix: string } {
  if (Buffer.byteLength(name, "utf8") <= 100) return { name, prefix: "" };

  const parts = name.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const candidate = parts.slice(index).join("/");
    const prefix = parts.slice(0, index).join("/");

    if (Buffer.byteLength(candidate, "utf8") <= 100 && Buffer.byteLength(prefix, "utf8") <= 155) {
      return { name: candidate, prefix };
    }
  }

  return { name: name.slice(0, 100), prefix: "" };
}

function octal(value: number, width: number): string {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

function createTarHeader(name: string, size: number, mode: number): Buffer {
  const header = Buffer.alloc(TAR_BLOCK, 0);
  const split = splitTarName(name);

  header.write(split.name, 0, 100, "utf8");
  header.write(octal(mode, 8), 100, 8, "ascii");
  header.write(octal(0, 8), 108, 8, "ascii");
  header.write(octal(0, 8), 116, 8, "ascii");
  header.write(octal(size, 12), 124, 12, "ascii");
  header.write(octal(0, 12), 136, 12, "ascii"); // 固定 mtime，保证产物可复现
  header.write("        ", 148, 8, "ascii");
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write(octal(0, 8), 329, 8, "ascii");
  header.write(octal(0, 8), 337, 8, "ascii");
  if (split.prefix) header.write(split.prefix, 345, 155, "utf8");

  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");

  return header;
}

function streamFileInto(gzip: Gzip, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(gzip, { end: false });
  });
}

/**
 * 把整个目录打包成 tar.gz（gzip 最高压缩级别）。
 * 不依赖系统的 tar / gzip，保证 Windows 与 Unix 行为一致。
 */
export async function createTarGz(rootDir: string, outputFile: string): Promise<ArchiveResult> {
  const files = collectFiles(rootDir, outputFile);

  const gzip = createGzip({ level: constants.Z_BEST_COMPRESSION });
  const output = createWriteStream(outputFile);

  const finished = new Promise<void>((resolve, reject) => {
    output.on("finish", resolve);
    output.on("error", reject);
    gzip.on("error", reject);
  });

  gzip.pipe(output);

  try {
    for (const file of files) {
      const baseName = path.basename(file.archivePath);
      const executable = !path.extname(baseName) && baseName.startsWith("wenku8-downloader");
      const mode = executable ? 0o755 : 0o644;

      gzip.write(createTarHeader(file.archivePath, file.stat.size, mode));
      await streamFileInto(gzip, file.absolutePath);

      const padding = (TAR_BLOCK - (file.stat.size % TAR_BLOCK)) % TAR_BLOCK;
      if (padding > 0) gzip.write(Buffer.alloc(padding));
    }

    // tar 以两个全零块结束
    gzip.end(Buffer.alloc(TAR_BLOCK * 2));
    await finished;
  } catch (error) {
    gzip.destroy();
    output.destroy();
    throw error;
  }

  return {
    file: outputFile,
    entries: files.length,
    bytes: statSync(outputFile).size,
  };
}
