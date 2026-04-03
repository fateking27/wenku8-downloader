import axios from "axios";

export async function checkUpdate() {
  try {
    const response = await axios.get(
      "https://api.github.com/repos/fateking27/wenku8-downloader/releases/latest",
    );
    const latestVersion = response.data.updated_at;
    return latestVersion;
  } catch (error) {
    console.error("检查更新失败:", error);
    return null;
  }
}