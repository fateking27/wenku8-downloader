import { axiosCreate } from "../../utils/axios.cjs";

const baseURL = "http://app.wenku8.com";

const toBase64String = (str) => {
  return Buffer.from(str).toString("base64");
};

// 获取小说详情
export const getBookMeta = async (data) => {
  const res = await axiosCreate.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=${data.meta}&aid=${data.novel_id}&t=${data.t}`
    ),
  });
  return res.data;
};

// 获取小说简介
export const getBookIntro = async (data) => {
  const res = await axiosCreate.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=${data.intro}&aid=${data.novel_id}&t=${data.t}`
    ),
  });
  return res.data;
};

// 获取小说目录
export const getBookList = async (data) => {
  const res = await axiosCreate.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=${data.list}&aid=${data.novel_id}&t=${data.t}`
    ),
  });
  return res.data;
};

// 获取小说章节内容
export const getBookText = async (data) => {
  const res = await axiosCreate.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=${data.text}&aid=${data.novel_id}&cid=${data.chapter_id}&t=${data.t}`
    ),
  });
  return res.data;
};
