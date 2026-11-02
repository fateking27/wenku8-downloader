import { confirm, input, password, select } from "@inquirer/prompts";
import {
  SETTINGS,
  loadWenku8Config,
  saveWenku8Config,
  type Wenku8FileConfig,
} from "../config";
import { wenku8Login } from "../http/web";
import { errorMessage, fail, line, paint, start, succeed, warn } from "../log";

type AccountAction = "edit" | "login" | "clear" | "back";

async function loginNow(): Promise<void> {
  const config = loadWenku8Config();
  if (!config.username || !config.password) {
    warn("请先输入账号和密码");
    return;
  }

  start("正在登录轻小说文库…");
  try {
    const ok = await wenku8Login({
      onAttempt: (attempt, total) => {
        start(`正在登录轻小说文库…（第 ${attempt}/${total} 次）`);
      },
    });

    if (ok) {
      succeed("登录成功，Cookie 已更新");
    } else {
      fail(
        `登录失败：已连续尝试 ${SETTINGS.loginAttempts} 次，请检查账号密码、网络或代理设置`,
      );
    }
  } catch (error) {
    fail(`登录失败：${errorMessage(error)}`);
  }
}

async function editAccount(config: Wenku8FileConfig): Promise<void> {
  line(paint("yellowBright", "提示：密码会以明文形式保存在 wenku8.json 中。"));

  const usernameInput = await input({
    message: "请输入账号（留空保持不变）",
    default: "",
  });

  const passwordInput = await password({
    message: "请输入密码（留空保持不变）",
    mask: "*",
  });

  const username = usernameInput.trim() || config.username || "";
  const passwordValue = passwordInput || config.password || "";

  if (!username) {
    warn("账号不能为空，未保存");
    return;
  }
  if (!passwordValue) {
    warn("密码不能为空，未保存");
    return;
  }
  if (!usernameInput.trim() && !passwordInput) {
    warn("没有修改任何内容");
    return;
  }

  saveWenku8Config({ ...config, username, password: passwordValue });
  succeed("账户信息已保存");

  const shouldTest = await confirm({
    message: "是否立即登录验证？",
    default: true,
    transformer: (value) => (value ? "YES" : "NO"),
  });
  if (shouldTest) await loginNow();
}

async function clearAccount(config: Wenku8FileConfig): Promise<void> {
  const alsoClearCookie = await confirm({
    message: "同时清除已保存的 Cookie？",
    default: false,
    transformer: (value) => (value ? "YES" : "NO"),
  });

  saveWenku8Config({
    ...config,
    username: "",
    password: "",
    cookie: alsoClearCookie ? "" : config.cookie,
  });
  succeed("账户信息已清除");
}

/** 主菜单的「账户设置」：查看 / 修改账号密码，并可直接登录验证。 */
export async function configureAccount(): Promise<void> {
  const config = loadWenku8Config();

  line();
  line(`当前账号：${config.username ? paint("green", config.username) : paint("yellow", "未配置")}`);
  line(`当前密码：${config.password ? paint("green", "已保存") : paint("yellow", "未保存")}`);
  line(`当前 Cookie：${config.cookie ? paint("green", "已配置") : paint("yellow", "未配置")}`);
  line();

  const action = await select<AccountAction>({
    message: "账户设置",
    default: "edit",
    choices: [
      { name: "输入 / 修改账号和密码", value: "edit" },
      { name: "立即登录验证", value: "login" },
      { name: "清除账号和密码", value: "clear" },
      { name: "返回主菜单", value: "back" },
    ],
  });

  switch (action) {
    case "edit":
      await editAccount(config);
      break;
    case "login":
      await loginNow();
      break;
    case "clear":
      await clearAccount(config);
      break;
    case "back":
      break;
  }
}
