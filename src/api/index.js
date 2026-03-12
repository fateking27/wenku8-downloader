import dayjs from "dayjs";
import { axios } from "../../utils/axiosToApp.cjs";

const baseURL = "https://wenku8-relay.mewx.org";

const toBase64String = (str) => {
  return Buffer.from(str).toString("base64");
};

// 获取小说详情
export const getBookMeta = async (data) => {
  return await axios.post(`${baseURL}`, {
    appver: "1.28",
    timetoken: dayjs().unix(),
    request: toBase64String(`action=book&do=meta&aid=${data.novel_id}&t=0`)
  });
};

/**
 * 获取小说目录
 * @example action=book&do=${data.list}&aid=${data.novel_id}&t=${data.t}
 * @data list,novel_id,t
 * @returns
 */
export const getBookList = async (data) => {
  return await axios.post(`${baseURL}`, {
    appver: "1.25-chibi-chapter-17d5f684",
    request: toBase64String(`action=book&do=list&aid=${data.novel_id}&t=0`),
  });
};

// 获取小说章节内容
export const getBookText = async (data) => {
  return await axios.post(`${baseURL}`, {
    appver: "1.25-chibi-chapter-17d5f684",
    request: toBase64String(
      `action=book&do=text&aid=${data.novel_id}&cid=${data.chapter_id}&t=0`,
    ),
  });
};
