import {EPub} from "@lesjoursfr/html-to-epub";
import {load} from "cheerio";
import {checkbox} from "@inquirer/prompts";
import path from "path";
import {axiosCreate} from "../../utils/axios.cjs";
import {reqInit} from "../request/index.cjs";
import {imageSize} from "image-size";
// import https from "https";
// import url from "url";
import ora from "ora";
import {existsSync, mkdirSync} from "fs";
import {
    getNovelChapters, getChapterContent, downloadNovelImages,
} from "../download.js";
import {getBookText} from "../api/index.js";
import {styleText} from "util";

const __dirname = import.meta.dirname; // 获取当前文件路径
const spinner = ora();
let retries = 3; //重试次数

/**
 * HTML转EPUB
 * @param {number} novel_id - 小说ID
 * @param {boolean} isApp - 是否为APP
 * @param {string} dlType - 下载类型
 */
const htmlToEpub = async (novel_id, isApp, dlType) => {
    spinner.start(styleText(["magenta"], "正在获取小说目录..."));
    const novelData = await getNovelChapters(novel_id.toString());
    spinner.succeed(styleText(["magenta"], "小说目录获取成功"));

    // const novelName = novelData.title.replace(/[\/:*?"<>|]/g, "：");
    const novelName = novelData.title.replace(/[\/:*?"<>|]/g, (match) => {
        switch (match) {
            case "/":
                return "";
            case ":":
                return "：";
            case "*":
                return "_";
            case "?":
                return "？";
            case "<":
                return "_";
            case ">":
                return "_";
            case "|":
                return "_";
        }
    });

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

    const epubDirPath = path.join(__dirname, `../../novels/epub/${novelName}` // 使用小说名称作为目录名
    );

    await mkdirsSync(epubDirPath); // 如果目录不存在，则创建目录
    let chapterVolume = novelData.chapters;

    if (dlType === "custom") {
        const checkValue = await checkbox({
            message: "请选择要下载的分卷",
            instructions: "（使用空格选择，Enter确认）",
            choices: chapterVolume.map((item) => ({
                name: item.chapter, value: item.id,
            })),
            pageSize: 10,
            loop: false,
        });
        chapterVolume = chapterVolume.filter((item) => checkValue.includes(item.id));
    }

    let num = 1;
    for (const item of chapterVolume) {
        if (item.children.length) {
            // const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, "？"); //将名称中的特殊字符替换
            //将名称中的特殊字符替换为对应的中文字符
            const chapterName = item.chapter.replace(/[\/:*?"<>|]/g, (match) => {
                switch (match) {
                    case "/":
                        return "";
                    case ":":
                        return "：";
                    case "*":
                        return "_";
                    case "?":
                        return "？";
                    case "<":
                        return "_";
                    case ">":
                        return "_";
                    case "|":
                        return "_";
                }
            });

            if (existsSync(`${epubDirPath}/${chapterName}.epub`)) {
                num++;
                continue;
            }
            let chapterContents = [];
            let epubCover = "";
            for (const chapter of item.children) {
                spinner.start("开始下载：" + styleText(["magenta"], `${item.chapter}、${chapter.title}`));

                //获取HTML内容
                let chapterText = isApp ? await getBookText({
                    novel_id, chapter_id: chapter.id,
                }).then((res) => res.data) : null;

                let chapterTextToHtml = chapterText ? `<div id="contentmain">
              <div id="content">
                ${chapterText.replace(/^\s*$/gm, "<br>")} // 替换空白行为<br>标签
              </div>
            </div>` : null;

                if (chapter.title === "插图" && chapterText) {
                    let contentHtml = chapterText.replace(/<!--image-->(.*?)<!--image-->/g, (match, p1) => {
                        return `<div class="divimage">
                <a href="${p1}" target="_blank">
                  <img src="${p1}" border="0" class="imagecontent">
                </a>
              </div>\n`;
                    });

                    chapterTextToHtml = `<div id="contentmain">
            <div id="content">
              ${contentHtml}
            </div>
          </div>`;
                }

                let chapterContent = null
                if (isApp) {
                    chapterContent = chapterTextToHtml
                } else {
                    spinner.stop()
                    await getChapterContent(novel_id, chapter.id, {
                        chapterName: item.chapter,
                        contentTitle: chapter.title
                    }).then(res => {
                        chapterContent = res
                    })
                }
                if (!chapterContent) {
                    spinner.fail(styleText(["redBright"], `未获取到章节内容，跳过下载: ${chapter.id}.${chapter.title}`));
                    continue;
                }
                const $ = load(chapterContent);
                spinner.succeed("下载完成：" + styleText(["magenta"], `${item.chapter}、${chapter.title}`));
                $("#title").remove();
                if (chapter.title === "插图") {
                    const imgUrls = [];
                    $("#content img").each(async (_, imgElement) => {
                        const imgUrl = $(imgElement).attr("src");
                        if (imgUrl) {
                            imgUrls.push(imgUrl);
                        }
                    });

                    // let coverSize = await new Promise((resolve, reject) => {
                    //   $("#content img:eq(0)").each((_, imgElement) => {
                    //     const imgUrl = $(imgElement).attr("src");
                    //     if (imgUrl) {
                    //       // 获取图片的尺寸
                    //       const options = url.parse(imgUrl);
                    //       https.get(options, function (response) {
                    //         const chunks = [];
                    //         response
                    //           .on("data", function (chunk) {
                    //             chunks.push(chunk);
                    //           })
                    //           .on("end", function () {
                    //             const buffer = Buffer.concat(chunks);
                    //             resolve(imageSize(buffer));
                    //           });
                    //       });
                    //     }
                    //   });
                    // });

                    const getEpubCover = async () => {
                        for (const imgUrl of imgUrls) {
                            const coverSize = await new Promise(async (resolve, reject) => {
                                const res = await axiosCreate
                                    .get(imgUrl, {
                                        ...reqInit().config,
                                    })
                                    .catch((error) => {
                                        console.log(`获取图片 ${imgUrl} 大小失败：`, error);
                                    });
                                if (res) {
                                    resolve(imageSize(res.data));
                                } else {
                                    resolve(false);
                                }
                            });
                            if (coverSize && coverSize.width / coverSize.height < 1) {
                                epubCover = imgUrl;
                                break;
                            } else if (!coverSize) {
                                getEpubCover();
                                break;
                            }
                        }
                    };
                    await getEpubCover();

                    // if (coverSize && coverSize.width / coverSize.height < 1) {
                    //   // 如果图片宽高比小于1，则将其作为封面
                    //   epubCover = $("#content img:eq(0)").attr("src");
                    // } else {
                    //   epubCover = $("#content img:eq(1)").attr("src");
                    // }

                    const contentMain = $("#content");
                    const imgList = contentMain
                        .find("img")
                        .map((_, imgElement) => $(imgElement).attr("src"))
                        .get()
                        .filter(Boolean);
                    await Promise.all(imgList.map((url) => downloadNovelImages(url, {novelName, chapterName})));

                    // 替换为本地图片地址
                    contentMain.find("img").each((_, imgElement) => {
                        const imgUrl = $(imgElement).attr("src");
                        if (imgUrl) {
                            const fileName = imgUrl.split("/").pop();
                            const newImgUrl = `file://${path.join(__dirname, `../../插图/${novelName}/${chapterName}/${fileName}`)}`;
                            $(imgElement).attr("src", newImgUrl);
                        }
                    });
                }

                chapterContents.push({
                    title: chapter.title, data: $("html").html(),
                });
            }
            const epub = new EPub({
                title: `${chapterName}`,
                author: novelData.author.split("：")[1],
                cover: epubCover ? epubCover : `${path.join(__dirname, "../../assets/nocover.jpg")}`, // useFirstImageAsCover: true,
                // publisher: "",
                tocTitle: "目录",
                lang: "zh-CN",
                content: chapterContents, // verbose: true,
            }, epubDirPath + `/${chapterName}.epub`);
            await epub.render().then(() => {
                spinner.succeed("下载完成：" + styleText(["greenBright", "bold", "inverse"], ` ${num++}/${chapterVolume.length} `) + styleText(["magenta"], ` 【${novelName}】${item.chapter}`));
            });
        }
    }
    spinner.succeed(styleText(["greenBright"], "小说《" + novelData.title + "》下载完毕" + "，请在novels/epub目录下查看"));
};

export {htmlToEpub};
