import { describe, expect, test } from "bun:test";
import { convertAppChapterText, detectRestrictedNotice } from "../src/domain/content";

describe("App 章节正文转换", () => {
  test("去掉标题前缀并保留段落", () => {
    const raw = [
      "",
      " 第一卷 1、测试章节 ",
      "",
      " ",
      "  ",
      "",
      "  第一段内容。",
      "",
      "  第二段内容。",
      "",
    ].join("\n");

    const result = convertAppChapterText(raw, "1、测试章节");

    expect(result.text).toContain("第一段内容。");
    expect(result.text).toContain("第二段内容。");
    expect(result.text).not.toContain("第一卷");
    expect(result.html).toContain("<p>第一段内容。</p>");
    expect(result.html).toContain("<p>第二段内容。</p>");
  });

  test("插图标记转成 img 标签", () => {
    const raw = [
      "",
      " 第一卷 插图 ",
      "",
      "  <!--image-->https://pic.wenku8.com/0/996/28995/33561.jpg<!--image-->  ",
      "  <!--image-->https://pic.wenku8.com/0/996/28995/33562.jpg<!--image-->  ",
    ].join("\n");

    const result = convertAppChapterText(raw, "插图");

    expect(result.images).toEqual([
      "https://pic.wenku8.com/0/996/28995/33561.jpg",
      "https://pic.wenku8.com/0/996/28995/33562.jpg",
    ]);
    expect(result.html.match(/<img /g)).toHaveLength(2);
    expect(result.text).not.toContain("<!--image-->");
  });

  test("正文中的尖括号被转义", () => {
    const result = convertAppChapterText("\n第一卷 测试\n\n主角说：<你好> & <再见>\n", "测试");
    expect(result.html).toContain("&lt;你好&gt;");
    expect(result.html).toContain("&amp;");
  });

  test("识别版权受限提示", () => {
    expect(detectRestrictedNotice("因版权原因，本书已下架，无法提供内容。")).not.toBeNull();
    expect(detectRestrictedNotice("这是一段正常的小说正文，篇幅足够长，不应该被误判。".repeat(20))).toBeNull();
  });
});
