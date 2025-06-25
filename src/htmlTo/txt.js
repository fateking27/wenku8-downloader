import { htmlToText } from "html-to-text";
import { selectNovelChapters, selectNovelDetail } from "../../models/wenku8_novel.js";
import { existsSync, readdirSync, statSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname as _dirname } from "path";
import { styleText } from "util";

// const __filename = fileURLToPath(import.meta.url); // 获取当前文件的绝对路径
// const __dirname = import.meta.dirname; // 获取当前文件路径

const htmlToTxt = async (novel_id) => {
  if (!novel_id) {
    console.log("小说id不能为空");
    return false;
  }

  const novelDetail = await new Promise((resolve, reject) => {
    selectNovelDetail(novel_id, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  if (
    !novelDetail ||
    !novelDetail.results ||
    novelDetail.results.length === 0
  ) {
    const message = styleText(
      "yellowBright",
      `ID [${novel_id}] 小说不存在或尚未入库，正在处理下一个小说TXT...\n`
    );
    console.log(message);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  const detail = novelDetail.results[0];
  if (!detail.updatetime || !detail.article_length) {
    const message = styleText(
      "yellowBright",
      `ID [${novel_id}] 该小说无法获取内容，正在处理下一个小说TXT...\n`
    );
    console.log(message);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  const chaptersData = await new Promise(async (resolve, reject) => {
    await selectNovelChapters(novel_id, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  }).catch(() => {});

  if (!chaptersData || !chaptersData.results.length) {
    // console.log(novel_id, "小说不存在或小说尚未入库，请检查！");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  const chapters = [];
  for (const item of JSON.parse(chaptersData.results[0].chapters)) {
    if (item.children.length) {
      chapters.push(...item.children);
    }
  }
  // console.log("chapters", chapters.length);

  const preFix =
    novel_id.toString().length < 4 ? "0" : novel_id.toString().split("")[0];
  const dirPath = join(
    __dirname,
    `../../../image-server/novel_files/wenku8/html/${preFix}/${novel_id}`
  );

  if (!existsSync(dirPath)) {
    // console.log(novel_id, "目标目录不存在");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  let fileList = [];
  const files = readdirSync(dirPath);
  for (const file of files) {
    const filePath = join(dirPath, file);
    const stat = statSync(filePath);
    //如果不是目录，则添加到文件列表
    if (!stat.isDirectory()) {
      fileList.push(filePath);
    }
  }

  // console.log("fileList", fileList.length);

  if (fileList.length != chapters.length) {
    // console.log(novel_id, "文件数量与章节数量不匹配，请检查");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  //递归创建多级目录
  const mkdirsSync = async (dirname) => {
    if (existsSync(dirname)) {
      return true;
    } else {
      if (mkdirsSync(_dirname(dirname))) {
        mkdirSync(dirname);
        return true;
      }
    }
  };

  const txtfullDirPath = join(
    __dirname,
    `../../../image-server/novel_files/wenku8/txtfull/${preFix}`
  );
  const txtDirPath = join(
    __dirname,
    `../../../image-server/novel_files/wenku8/txt/${novel_id}`
  );

  //分卷写入
  const chapterVolume = JSON.parse(chaptersData.results[0].chapters);
  // console.log("chapters", chapterVolume[0]);
  for (const item of chapterVolume) {
    if (item.children.length) {
      if (existsSync(`${txtDirPath}/${item.id}.txt`)) {
        // console.log(`章节《${item.chapter}》已存在`);
        continue;
      }
      for (const chapter of item.children) {
        const filePath = join(dirPath, `${chapter.id}.html`);
        if (!existsSync(filePath)) {
          console.log(`文件 ${chapter.id}.html 不存在, 请检查`);
          throw new Error(`文件 ${chapter.id}.html 不存在, 请检查`);
        }
        if (chapter.title == "插图") {
          continue;
        }
        const html = readFileSync(filePath, "utf8");
        const text = htmlToText(html, {
          wordwrap: 130,
          ignoreHref: true,
          ignoreImage: true,
          selectors: [
            {
              selector: "#contentdp",
              format: "skip",
            },
          ],
        });
        // 如果目录不存在，则创建目录
        await mkdirsSync(txtDirPath);
        //将名称中的特殊字符替换
        // const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "？");
        writeFileSync(`${txtDirPath}/${item.id}.txt`, `\n\n${text}\n`, {
          flag: "a", //追加写入
          encoding: "utf-8",
        });
      }
    }
  }

  if (existsSync(join(`${txtfullDirPath}/${novel_id}.txt`))) {
    console.log(`小说《${chaptersData.results[0].title}》TXT已存在`);
    if (novel_id >= 3900) return;
    return htmlToTxt(novel_id + 1);
  }

  //全本写入
  for (const item of chapters) {
    const filePath = join(dirPath, `${item.id}.html`);
    if (!existsSync(filePath)) {
      console.log(`文件 ${item.id}.html 不存在, 请检查`);
      //清空文件内容
      if (existsSync(join(`${txtfullDirPath}/${novel_id}.txt`))) {
        writeFileSync(`${txtfullDirPath}/${novel_id}.txt`, "");
      }
      if (novel_id >= 3900) return;
      return htmlToTxt(novel_id + 1);
    }
    const html = readFileSync(filePath, "utf8");
    const text = htmlToText(html, {
      wordwrap: 130,
      ignoreHref: true,
      ignoreImage: true,
      selectors: [
        {
          selector: "#contentdp",
          format: "skip",
        },
      ],
    });
    // 将文本写入到同名的txt文件中
    // 如果目录不存在，则创建目录
    await mkdirsSync(txtfullDirPath);
    writeFileSync(`${txtfullDirPath}/${novel_id}.txt`, `\n\n${text}\n`, {
      flag: "a", //追加写入
      encoding: "utf-8",
    });
  }

  console.log("小说《" + chaptersData.results[0].title + "》写入完成");

  if (novel_id >= 3900) return;

  return htmlToTxt(novel_id + 1);
};
htmlToTxt(1);

setInterval(() => {
  htmlToTxt(1);
}, 1000 * 60 * 60 * 2);
