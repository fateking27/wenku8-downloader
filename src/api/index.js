import { axios } from "../../utils/axiosToApp.cjs";

const baseURL = "http://app.wenku8.com";

const toBase64String = (str) => {
  return Buffer.from(str).toString("base64");
};

// 获取小说详情
export const getBookMeta = async (data) => {
  return await axios.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=meta&aid=${data.novel_id}&t=0`
    ),
  });
};

// 获取小说简介
export const getBookIntro = async (data) => {
  return await axios.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=intro&aid=${data.novel_id}&t=0`
    ),
  });
};

/**
 * 获取小说目录
 * @example action=book&do=${data.list}&aid=${data.novel_id}&t=${data.t}
 * @data list,novel_id,t
 * @returns
 */
export const getBookList = async (data) => {
  return await axios.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=list&aid=${data.novel_id}&t=0`
    ),
  });
};

// 获取小说章节内容
export const getBookText = async (data) => {
  return await axios.post(`${baseURL}/android.php`, {
    appver: "1.21",
    request: toBase64String(
      `action=book&do=text&aid=${data.novel_id}&cid=${data.chapter_id}&t=0`
    ),
  });
};
