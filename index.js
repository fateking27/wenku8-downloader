import { select, checkbox, confirm, input, number } from "@inquirer/prompts";
import { styleText } from "util";
import Table from "cli-table3";
import { exec } from "child_process";

import { getNovelDetail } from "./src/getNovelDetal.cjs";

import { htmlToEpub } from "./src/htmlTo/epub.js";
console.log(
  styleText("green", "欢迎使用wenku8轻小说文库下载器，https://xxx.xxx.top\n")
);

const start = async () => {
  const answer_1 = await select({
    message: "你打算做什么?",
    default: 3,
    // instructions: {
    //   navigation: "请使用方向键选择",
    // },
    choices: [
      // {
      //   name: "查看热门小说",
      //   value: 1,
      //   // description: "npm is the most popular package manager",
      // },
      // {
      //   name: "查看近期更新小说",
      //   value: 2,
      //   // description: "yarn is an awesome package manager",
      // },
      {
        name: "查询小说",
        value: 3,
        // description: "yarn is an awesome package manager",
      },
    ],
  });

  if (answer_1 === 3) {
    const select_res = await select({
      message: "选择查询方式",
      default: 1,
      instructions: {
        navigation: "请使用方向键选择",
      },
      choices: [
        {
          name: "ID查询",
          value: 1,
          // description: "npm is the most popular package manager",
        },
        // {
        //   name: "小说名称搜索",
        //   value: 2,
        //   // description: "yarn is an awesome package manager",
        // },
      ],
    });

    if (select_res === 1) {
      const num_res = await number({
        message: "请输入小说ID",
      });

      const novel_detail = await getNovelDetail(num_res);

      if (!novel_detail) {
        console.log(
          styleText(
            "yellowBright",
            "\n小说不存在或获取失败，请检查ID是否正确\n"
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return start(); // 重新开始操作
      }

      console.log(`\n简介：${novel_detail.brief}`);

      const table = new Table({
        head: [
          "小说名",
          "作者",
          "标签",
          "状态",
          "更新时间",
          "全文字数",
          "最新章节",
        ],
        // colWidths: [30, 15, 30, 10, 15, 15, 30],
        style: {
          head: ["red"],
          border: ["green"],
        },
        truncate: "...",
      });

      //输出table表格
      table.push([
        novel_detail.name,
        novel_detail.author,
        novel_detail.tags,
        novel_detail.status,
        novel_detail.updatetime,
        novel_detail.article_length,
        novel_detail.latest_chapter,
      ]);

      console.log(table.toString());

      if (
        !novel_detail.article_length &&
        !novel_detail.latest_chapter &&
        !novel_detail.updatetime
      ) {
        console.log(
          styleText(
            "yellowBright",
            "\n因版权问题，文库不再提供该小说的在线阅读与下载服务！ ——轻小说文库\n"
          )
        );
        return start(); // 重新开始操作
      }

      await confirm({
        message: "是否下载该小说?",
        default: true,
        transformer: (value) => (value ? "YES" : "NO"),
      }).then(async (res) => {
        if (res) {
          const novel_dl_select = await select({
            message: "选择下载小说格式",
            default: 1,
            choices: [
              {
                name: "epub",
                value: 1,
              },
              // {
              //   name: "txt",
              //   value: 2,
              // },
            ],
          });
          if (novel_dl_select === 1) {
            await htmlToEpub(num_res);
          } else if (novel_dl_select === 2) {
            // 这里可以添加下载txt格式小说的逻辑
          }

          await confirm({
            message: "小说下载完成，是否打开目录?",
            default: true,
            transformer: (value) => (value ? "YES" : "NO"),
          }).then((res) => {
            if (res) {
              // 打开目录
              exec(
                `start "" "${import.meta.dirname}/novels/epub/${
                  novel_detail.name
                }"`
              );
            }
          });
        } else {
          console.log("已取消下载");
        }
      });
      // .catch((error) => {
      //   console.error("发生错误:", error);
      // });
    }
  }

  await start(); // 重新开始操作
};

// 启动程序
start().catch((error) => {
  console.error("发生错误:", error);
});
