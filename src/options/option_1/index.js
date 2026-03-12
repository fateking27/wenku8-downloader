import { select } from "@inquirer/prompts";
import { option_1_1 } from "./option_1_1/index.js";
import { option_1_2 } from "./option_1_2/index.js";
import { option_1_3 } from "./option_1_3/index.js";

export const option_1 = async () => {
  const answer = await select({
    message: "查询方式",
    default: 1,
    choices: [
      {
        name: "ID查询",
        value: 1,
      },
      {
        name: "小说标题查询",
        value: 2,
      },
      {
        name: "作者名称查询",
        value: 3,
      },
    ],
  });

  switch (answer) {
    case 1:
      await option_1_1();
      break;
    case 2:
      await option_1_2();
      break;
    case 3:
      await option_1_3();
      break;
    default:
      break;
  }
};
