const { axiosCreate } = require("../../utils/axios.cjs");
const wenku8Cookie = require("../../utils/wenku8.json");
const iconv = require("iconv-lite");
const fs = require("fs");
const path = require("path");

const userAgents = [
  "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.8.0.12) Gecko/20070731 Ubuntu/dapper-security Firefox/1.5.0.12",
  "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Acoo Browser; SLCC1; .NET CLR 2.0.50727; Media Center PC 5.0; .NET CLR 3.0.04506)",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/535.11 (KHTML, like Gecko) Chrome/17.0.963.56 Safari/535.11",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/535.20 (KHTML, like Gecko) Chrome/19.0.1036.7 Safari/535.20",
  "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9.0.8) Gecko Fedora/1.9.0.8-1.fc10 Kazehakase/0.5.6",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.71 Safari/537.1 LBBROWSER",
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0; .NET CLR 3.5.30729; .NET CLR 3.0.30729; .NET CLR 2.0.50727; Media Center PC 6.0) ,Lynx/2.8.5rel.1 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/1.2.9",
  "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322; .NET CLR 2.0.50727)",
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; QQBrowser/7.0.3698.400)",
  "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; QQDownload 732; .NET4.0C; .NET4.0E)",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:2.0b13pre) Gecko/20110307 Firefox/4.0b13pre",
  "Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; fr) Presto/2.9.168 Version/11.52",
  "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.8.0.12) Gecko/20070731 Ubuntu/dapper-security Firefox/1.5.0.12",
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; LBBROWSER)",
  "Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9.0.8) Gecko Fedora/1.9.0.8-1.fc10 Kazehakase/0.5.6",
  "Mozilla/5.0 (X11; U; Linux; en-US) AppleWebKit/527+ (KHTML, like Gecko, Safari/419.3) Arora/0.6",
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; QQBrowser/7.0.3698.400)",
  "Opera/9.25 (Windows NT 5.1; U; en), Lynx/2.8.5rel.1 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/1.2.9",
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36",
];

const randomHead = () => {
  return userAgents[
    Math.floor(Math.random() * (0 - userAgents.length) + userAgents.length)
  ];
};

const returnIp = () => {
  return (
    Math.floor(Math.random() * 256) +
    "." +
    Math.floor(Math.random() * 256) +
    "." +
    Math.floor(Math.random() * 256) +
    "." +
    Math.floor(Math.random() * 256)
  );
};

const wenku8Login = async () => {
  const formData = new FormData();
  formData.append("username", "fk233");
  formData.append("password", "test233");
  // formData.append("checkcode", "5095");
  formData.append("usecookie", "315360000");
  formData.append("action", "login");
  formData.append("submit", " 登  录 ");
  const loginRes = await axiosCreate
    .post(
      "https://www.wenku8.net/login.php?do=submit&jumpurl=https://www.wenku8.net/index.php",
      formData,
      {
        responseType: "arraybuffer",
        headers: {
          referer:
            "https://www.wenku8.net/login.php?jumpurl=http%3A%2F%2Fwww.wenku8.net%2Findex.php",
          "User-Agent": randomHead(),
          "X-Forwarded-For": returnIp(),
          "X-Real-IP": "127.0.0.1",
        },
      }
    )
    .catch(() => {});
  if (!loginRes) return;
  // console.log(loginRes,"wenku8--登录成功");
  const cookies = loginRes.headers["set-cookie"].map((cookieItem) => {
    cookieItem = cookieItem.split(";")[0];
    return cookieItem;
  });
  wenku8Cookie.cookie = cookies.slice(1).join(";");
  fs.writeFileSync(
    path.resolve(__dirname, "../../utils/wenku8.json"),
    JSON.stringify(wenku8Cookie),
    { encoding: "utf-8" }
  );
};

const reqInit = (indexRes) => {
  const config = {
    withCredentials: true,
    responseType: "arraybuffer",
    headers: {
      Cookie: wenku8Cookie.cookie,
      referer: "https://www.wenku8.net/index.php",
      "User-Agent": randomHead(),
      "X-Forwarded-For": returnIp(),
      "X-Real-IP": "127.0.0.1",
    },
  };
  let html = null;
  if (indexRes) {
    html = iconv.decode(indexRes.data, "gbk"); //将gbk编码解码为utf-8
  }
  return {
    config,
    html,
  };
};

module.exports = {
  wenku8Login,
  reqInit,
};
