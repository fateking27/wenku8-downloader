const axios = require("axios");

const axiosCreate = axios.create();
const CancelToken = axios.CancelToken;

axiosCreate.defaults.timeout = 10000; //请求超时

axiosCreate.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/x-www-form-urlencoded";
  return config;
});

module.exports = {
  axiosCreate,
  CancelToken,
};
