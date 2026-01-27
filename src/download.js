import {reqInit} from "./request/index.cjs";
import {axiosCreate} from "../utils/axios.cjs";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import ora from "ora";
import {styleText} from "util";
import {confirm} from "@inquirer/prompts";
import {novel_dl_select} from "./options/novel_dl_select.js";

const __dirname = import.meta.dirname;
const spinner = ora();

//递归创建多级目录
const mkdirsSync = async (dirname) => {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
};

// 获取小说目录
const getNovelChapters = async (novelId) => {
    let statusCode = null;
    const indexRes = await axiosCreate
        .get(`https://www.wenku8.net/novel/${novelId.length < 4 ? "0" : novelId.split("")[0]}/${novelId}/index.htm`, {
            ...reqInit().config,
        })
        .catch(async (error) => {
            // console.log(obj.id, error.stack);
            if (error.status == 404) {
                console.log(`小说目录不存在`);
                statusCode = 404;
            }
        });
    if (!indexRes && statusCode === 404) {
        return false;
    } else if (!indexRes) {
        return getNovelChapters(novelId);
    }

    if (indexRes && indexRes.status == 200) {
        // console.log(reqInit(indexRes).html);
        if (reqInit(indexRes).html == undefined) {
            console.log("未获取到小说目录");
            await getNovelChapters(novelId);
            return;
        }
        const $ = cheerio.load(reqInit(indexRes).html);
        const novel_chapters = {};
        $("body").each((index, element) => {
            novel_chapters.title = $(element).find("#title").text();
            novel_chapters.author = $(element).find("#info").text();
            novel_chapters.chapters = $(element)
                .find(".css tr>td")
                .map((index, element) => {
                    const data = [];
                    if ($(element).attr("class") == "vcss" && $(element).attr("vid")) {
                        data.push({
                            id: $(element).attr("vid"), chapter: $(element).text(), children: [],
                        });
                    }
                    if ($(element).attr("class") == "ccss" && $(element).find("a").attr("href")) {
                        data.push({
                            id: $(element).find("a").attr("href").split(".")[0], title: $(element).text(),
                        });
                    }
                    const chapters = [];
                    data.forEach((item) => {
                        if (item.children) {
                            chapters.push(item);
                        }
                    });
                    return data;
                })
                .get();
        });

        // console.log(reqInit(indexRes).html);

        novel_chapters.chapters = novel_chapters.chapters.reduce((acc, item) => {
            if (item.chapter) {
                acc.push({...item, children: []});
            } else {
                const lastChapter = acc[acc.length - 1];
                if (lastChapter) {
                    lastChapter.children.push(item);
                }
            }
            return acc;
        }, []);

        return novel_chapters;
    }
};

let getContentCount = 0
//获取章节内容
const getChapterContent = async (novelId, chapterId, chapterTitle) => {
    const urlPrefix = novelId.toString().length < 4 ? "0" : novelId.toString().split("")[0];
    const url = `https://www.wenku8.net/novel/${urlPrefix}/${novelId}/${chapterId}.htm`;
    let statusCode = null;
    const indexRes = await axiosCreate
        .get(url, {
            ...reqInit().config,
        })
        .catch((error) => {
            if (error.status === 404) {
                statusCode = 404;
                // console.log(`章节内容不存在: ${url}`);
            }
        });

    if (!indexRes && statusCode === 404) {
        if (getContentCount >= 3) {
            console.log(styleText(["yellowBright"], `⚠ 未获取到章节内容：`) +
                styleText('magenta', `${chapterTitle.chapterName}、${chapterTitle.contentTitle}`))
            let isTry = false
            await confirm({
                message: `已重试${getContentCount}次，是否继续？`,
                default: true,
                transformer: (value) => (value ? "YES" : "NO"),
            }).then(res => {
                isTry = res
            })
            if (!isTry) {
                getContentCount = 0
                return false;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        getContentCount += 1;
        return await getChapterContent(novelId, chapterId, chapterTitle);
    } else if (!indexRes) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待3秒后重试
        return await getChapterContent(novelId, chapterId, chapterTitle);
    }

    if (!indexRes) return false;

    const html = reqInit(indexRes).html;
    let $ = cheerio.load(html);
    const contentMain = $("#contentmain");
    //去除多余的标签
    contentMain.find("script").remove();
    //替换掉多余的标签
    contentMain.find("#adv300").replaceWith("<div><div/>");
    contentMain.find("#adv900").replaceWith("<div><div/>");
    contentMain.find("#contentdp").replaceWith("");

    getContentCount = 0
    return contentMain.html();
};

//下载小说插图
const downloadNovelImages = async (url, obj) => {
    const fileName = url.split("/").pop();
    spinner.start("插图下载中：" + styleText(["magenta"], `${url}`));
    //判断插图是否已存在
    if (fs.existsSync(path.join(__dirname, `../插图/${obj.novelName}/${obj.chapterName}/${fileName}`))) {
        spinner.succeed("插图下载完成：" + styleText(["magenta"], `${fileName}`));
        return true;
    }
    let statusCode = null;
    const indexRes = await axiosCreate
        .get(url, {
            ...reqInit().config,
        })
        .catch((error) => {
            if (error.status === 404) {
                statusCode = 404;
            }
        });

    if (!indexRes && statusCode === 404) {
        return false;
    } else if (!indexRes) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待3秒后重试
        return await downloadNovelImages(url, obj);
    }

    const dirPath = path.join(__dirname, `../插图/${obj.novelName}/${obj.chapterName}`);
    await mkdirsSync(dirPath);
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, indexRes.data);
    spinner.succeed("插图下载完成：" + styleText(["magenta"], `${fileName}`));
};

export {getNovelChapters, getChapterContent, downloadNovelImages};
