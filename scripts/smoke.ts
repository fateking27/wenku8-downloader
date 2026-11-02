#!/usr/bin/env bun
/**
 * 联网自检（不会写入小说文件，只下载一张封面）
 *
 *   bun scripts/smoke.ts
 */
import { AppClient } from "../src/app/client";
import { magicAppver } from "../src/app/appver";
import { getCatalog } from "../src/domain/catalog";
import { fetchChapter } from "../src/domain/content";
import { getNovelDetail } from "../src/domain/detail";
import { downloadCover } from "../src/domain/images";

async function step<T>(name: string, task: () => Promise<T>): Promise<T | null> {
  try {
    const value = await task();
    console.log(`PASS  ${name}`);
    return value;
  } catch (error) {
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

console.log(`appver = ${magicAppver()}`);

const client = new AppClient();

const meta = await step("book&do=meta (4469)", () => client.meta(4469));
if (meta) console.log(`      Title=${meta["Title"]} BookLength=${meta["BookLength"]}`);

const volumes = await step("book&do=list (996)", () => client.volumeList(996));
if (volumes) console.log(`      volumes=${volumes.length}  chapters=${volumes[0]?.chapters.length}`);

const text = await step("book&do=text (996/28990)", () => client.chapterText(996, 28990));
if (text) console.log(`      chars=${text.length}  head=${JSON.stringify(text.slice(0, 40))}`);

const coverBytes = await step("book&do=cover (4469)", () => client.cover(4469));
if (coverBytes) console.log(`      bytes=${coverBytes.length}`);

const search = await step("search 剑", () => client.search("剑"));
if (search) console.log(`      results=${search.length}  first=${search[0]?.name}`);

console.log("\n--- 完整回退链路（网页不可用时自动走 App 中继）---");
const detail = await step("getNovelDetail (4469)", () => getNovelDetail(4469));
if (detail) {
  console.log(
    `      source=${detail.source} restricted=${detail.restricted} name=${detail.name} wordCount=${detail.wordCount}`,
  );

  const catalog = await step("getCatalog", () => getCatalog(detail));
  if (catalog) {
    console.log(`      catalog.source=${catalog.source} volumes=${catalog.volumes.length}`);

    const chapter = catalog.volumes[0]?.chapters[1];
    if (chapter) {
      const content = await step("fetchChapter", () => fetchChapter(catalog, chapter));
      if (content) {
        console.log(
          `      title=${content.title} html=${content.html.length} text=${content.text.length} images=${content.images.length}`,
        );
      }
    }
  }

  const cover = await step("downloadCover", () => downloadCover(detail));
  if (cover) console.log(`      ${cover}`);
}
