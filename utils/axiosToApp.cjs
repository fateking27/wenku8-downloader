const { create, CancelToken } = require("axios");
const qs = require("qs");

const axios = create();

axios.interceptors.request.use(
  (config) => {
    config.headers["Content-Type"] = "application/x-www-form-urlencoded";
    config.headers["Accept-Encoding"] = "gzip";
    config.headers["User-Agent"] =
      "Dalvik/2.1.0 (Linux; U; Android 15; V2425A Build/AP3A.240905.015.A2_V000L1)";
    config.headers["Accept-Language"] = "zh-CN,zh;q=0.9";
    config.headers["Cache-Control"] = "max-age=0";
    config.headers.Connection = "keep-alive";

    //只对POST请求做处理
    if (config.method === "post" && config.data) {
      config.data = qs.stringify(config.data);
      // console.log(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

module.exports = {
  axios,
  CancelToken,
};
