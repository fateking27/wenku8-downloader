const { create, CancelToken } = require("axios");

const axios = create();

axios.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/x-www-form-urlencoded";
  config.headers["Accept-Encoding"] = "gzip";
  config.headers["User-Agent"] =
    "Dalvik/2.1.0 (Linux; U; Android 15; V2425A Build/AP3A.240905.015.A2_V000L1)";
  config.headers["Accept-Language"] = "zh-CN,zh;q=0.9";
  config.headers["Cache-Control"] = "max-age=0";
  config.headers.Connection = "keep-alive";

  return config;
});

module.exports = {
  axios,
  CancelToken,
};
