import { select, checkbox, confirm, input, number } from "@inquirer/prompts";
import { option_1_1 } from "./option_1_1/index.js";
import { options } from "../index.js";

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
        name: "小说名查询",
        value: 2,
      },
      {
        name: "作者名查询",
        value: 3,
      },
      {
        name: "返回上一步",
        value: 0,
      },
    ],
  });

  switch (answer) {
    case 1:
      await option_1_1();
      break;
    case 2:
      // await option_3_2();
      break;
    case 0:
      await options();
      break;
    default:
      break;
  }
};
