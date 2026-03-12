import { select } from "@inquirer/prompts";

import { option_1 } from "./option_1/index.js";
import { option_2 } from "./option_2/index.js";
import { option_3 } from "./option_3/index.js";
import { option_4 } from "./option_4/index.js";

export const options = async () => {
  const answer = await select({
    message: "你打算做什么?",
    default: 1,
    choices: [
      {
        name: "查询小说",
        value: 1,
      },
      {
        name: "今日热榜",
        value: 2,
      },
      {
        name: "新书风云榜",
        value: 3,
      },
      {
        name: "查看最近更新轻小说",
        value: 4,
      },
    ],
  });

  switch (answer) {
    case 1:
      // 查询小说
      await option_1();
      break;
    case 2:
      // 今日热榜
      await option_2();
      break;
    case 3:
      // 新书风云榜
      await option_3();
      break;
    case 4:
      // 近期更新小说
      await option_4();
      break;
  }
};
