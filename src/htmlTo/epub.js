import { EPub } from "@lesjoursfr/html-to-epub";
import { load } from "cheerio";
import path from "path";
import { imageSize } from "image-size";
import https from "https";
import url from "url";
import ora from "ora";
import {
  existsSync,
  mkdirSync,
} from "fs";
import {
  getNovelChapters,
  getChapterContent,
  downloadNovelImages,
} from "../download.js";
import { styleText } from "util";

const __dirname = import.meta.dirname; // 获取当前文件路径
const spinner = ora();

const htmlToEpub = async (novel_id) => {
  const novelData = await getNovelChapters(novel_id.toString());
  const novelName = novelData.title.replace(/[\/:*?"<>|]/g, "？");

  //递归创建多级目录
  const mkdirsSync = async (dirname) => {
    if (existsSync(dirname)) {
      return true;
    } else {
      if (mkdirsSync(path.dirname(dirname))) {
        mkdirSync(dirname);
        return true;
      }
    }
  };

  const epubDirPath = path.join(
    __dirname,
    `../../novels/epub/${novelName}` // 使用小说名称作为目录名
  );

  await mkdirsSync(epubDirPath); // 如果目录不存在，则创建目录
  const chapterVolume = novelData.chapters;
  let num = 1;
  for (const item of chapterVolume) {
    if (item.children.length) {
      const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "？"); //将名称中的特殊字符替换
      let chapterContents = [];
      let epubCover = "";
      for (const chapter of item.children) {
        spinner.start(
          "开始下载：" +
            styleText(["magenta"], `${item.chapter}、${chapter.title}`)
        );

        //获取HTML内容
        let chapterContent = await getChapterContent(novel_id, chapter.id);
        if (!chapterContent) {
          spinner.fail(
            styleText(
              ["redBright"],
              `章节内容不存在跳过下载: ${chapter.id}.${chapter.title}`
            )
          );
          continue;
        }
        const $ = load(chapterContent);
        spinner.succeed(
          "下载完成：" +
            styleText(["magenta"], `${item.chapter}、${chapter.title}`)
        );
        $("#title").remove();
        if (chapter.title == "插图") {
          let coverSize = await new Promise((resolve, reject) => {
            $("#content img:eq(0)").each((_, imgElement) => {
              const imgUrl = $(imgElement).attr("src");
              if (imgUrl) {
                // 获取图片的尺寸
                const options = url.parse(imgUrl);
                https.get(options, function (response) {
                  const chunks = [];
                  response
                    .on("data", function (chunk) {
                      chunks.push(chunk);
                    })
                    .on("end", function () {
                      const buffer = Buffer.concat(chunks);
                      resolve(imageSize(buffer));
                    });
                });
              }
            });
          });

          if (coverSize && coverSize.width / coverSize.height < 1) {
            // 如果图片宽高比小于1，则将其作为封面
            epubCover = $("#content img:eq(0)").attr("src");
          } else {
            epubCover = $("#content img:eq(1)").attr("src");
          }
          const contentMain = $("#content");
          const imgList = contentMain
            .find("img")
            .map((_, imgElement) => $(imgElement).attr("src"))
            .get()
            .filter(Boolean);
          await Promise.all(
            imgList.map((url) =>
              downloadNovelImages(url, { novelName, chapterName })
            )
          );
          // 替换为本地图片地址
          contentMain.find("img").each((_, imgElement) => {
            const imgUrl = $(imgElement).attr("src");
            if (imgUrl) {
              const fileName = imgUrl.split("/").pop();
              const newImgUrl = `file://${path.join(
                __dirname,
                `../../插图/${novelName}/${chapterName}/${fileName}`
              )}`;
              $(imgElement).attr("src", newImgUrl);
            }
          });
        }

        chapterContents.push({
          title: chapter.title,
          data: $("html").html(),
        });
      }
      const epub = new EPub(
        {
          title: `${chapterName}`,
          author: novelData.author.split("：")[1],
          cover: epubCover,
          // useFirstImageAsCover: true,
          // publisher: "",
          tocTitle: "目录",
          lang: "zh-CN",
          content: chapterContents,
          // verbose: true,
        },
        epubDirPath + `/${novelData.title} ${chapterName}.epub`
      );
      await epub.render().then(() => {
        spinner.succeed(
          "下载完成：" +
            styleText(
              ["greenBright", "bold", "inverse"],
              ` ${num++}/${chapterVolume.length} `
            ) +
            styleText(["magenta"], ` 【${novelData.title}】${item.chapter}`)
        );
      });
    }
  }
  spinner.succeed(
    styleText(
      ["greenBright"],
      "小说《" + novelData.title + "》下载完毕" + "，请在novels/epub目录下查看"
    )
  );
};

export { htmlToEpub };
