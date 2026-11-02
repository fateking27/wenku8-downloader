import { describe, expect, test } from "bun:test";
import { sanitizeFileName } from "../src/util/fs";
import {
  extractNovelId,
  parseCatalogPage,
  parseDetailPage,
  parseRankingPage,
  parseSearchPage,
} from "../src/web/parse";

describe("文件名安全化", () => {
  test("替换非法字符并去除结尾点号", () => {
    expect(sanitizeFileName('刀剑神域: Alicorn "x"?.')).toBe("刀剑神域： Alicorn ＂x＂？");
    expect(sanitizeFileName("a/b\\c")).toBe("a／b＼c");
  });

  test("空名称有兜底", () => {
    expect(sanitizeFileName("   ")).toBe("未命名");
  });
});

describe("网页解析", () => {
  test("从链接提取小说 ID", () => {
    expect(extractNovelId("/book/4469.htm")).toBe("4469");
    expect(extractNovelId("https://www.wenku8.net/book/996.htm")).toBe("996");
    expect(extractNovelId("/novel/0/996/28989.htm")).toBe("996");
  });

  test("解析章节目录（vcss / ccss）", () => {
    const html = `
      <html><body>
        <div id="title">未来都市NO.6</div>
        <div id="info">作者：浅野敦子</div>
        <table class="css">
          <tr><td class="vcss" vid="28988">第一卷</td></tr>
          <tr><td class="ccss"><a href="28989.htm">人物介绍</a></td></tr>
          <tr><td class="ccss"><a href="28990.htm">1、湿漉漉的老鼠</a></td></tr>
          <tr><td class="vcss" vid="29994">第二卷</td></tr>
          <tr><td class="ccss"><a href="29995.htm">1 生与死</a></td></tr>
        </table>
      </body></html>`;

    const parsed = parseCatalogPage(html);
    expect(parsed?.title).toBe("未来都市NO.6");
    expect(parsed?.author).toBe("浅野敦子");
    expect(parsed?.volumes).toHaveLength(2);
    expect(parsed?.volumes[0]?.id).toBe("28988");
    expect(parsed?.volumes[0]?.chapters[1]?.id).toBe("28990");
    expect(parsed?.volumes[1]?.chapters[0]?.title).toBe("1 生与死");
  });

  test("解析详情页字段", () => {
    const html = `
      <html><body>
        <div id="content">
          <div>
            <table>
              <tr><td><span><b>未来都市NO.6</b></span></td></tr>
              <tr><td><span>文库分类：轻小说</span></td></tr>
              <tr>
                <td>文库分类：轻小说</td>
                <td>作者：浅野敦子</td>
                <td>状态：已完成</td>
                <td>更新时间：2020-04-01</td>
                <td>全文长度：123456字</td>
              </tr>
            </table>
            <table>
              <tr>
                <td><img src="//img.wenku8.com/image/0/996/996s.jpg" /></td>
                <td>
                  <span>标签：紫苑 老鼠 沙布</span>
                  <span></span><span></span>
                  <span>最新章节：最终章</span>
                  <span>简介：简介内容</span>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body></html>`;

    const detail = parseDetailPage(html, "996");
    expect(detail?.name).toBe("未来都市NO.6");
    expect(detail?.author).toBe("浅野敦子");
    expect(detail?.status).toBe("已完成");
    expect(detail?.updateTime).toBe("2020-04-01");
    expect(detail?.wordCount).toBe("123456字");
    expect(detail?.tags).toBe("紫苑 老鼠 沙布");
    expect(detail?.latestChapter).toBe("最终章");
    expect(detail?.brief).toBe("简介内容");
    expect(detail?.cover).toBe("https://img.wenku8.com/image/0/996/996s.jpg");
  });

  test("解析实际详情页：作品Tags / 最近章节 / 内容简介", () => {
    // 实际页面：信息表里嵌套了标题表，标签与内容被拆成相邻的 span。
    const html = `
      <html><body>
        <div id="content">
          <div>
            <table>
              <tbody>
                <tr><td colspan="5"><table><tbody><tr>
                  <td><span><b>未来都市NO.6</b></span></td>
                  <td>[举报/报错]</td>
                </tr></tbody></table></td></tr>
                <tr>
                  <td>文库分类：讲谈社</td>
                  <td>小说作者：浅野敦子</td>
                  <td>文章状态：已完结</td>
                  <td>最后更新：2013-08-24</td>
                  <td>全文长度：574996字</td>
                </tr>
              </tbody>
            </table>
            <div style="height:1px"></div>
            <table>
              <tbody><tr>
                <td><img src="http://img.wenku8.com/image/0/996/996s.jpg" /></td>
                <td>
                  <span class="hottext">作品Tags：科幻 青春 冒险 耽美</span>
                  <span class="hottext">作品热度：C级</span>
                  <span class="hottext">最近章节：</span>
                  <span>第九卷 插图</span>
                  <span class="hottext">内容简介：</span>
                  <span>这是一段小说简介正文，通常比较长，用于确认简介解析正确。<br>
                  第二行简介内容。<br>
                  第三行简介内容。</span>
                </td>
              </tr></tbody>
            </table>
          </div>
        </div>
      </body></html>`;

    const detail = parseDetailPage(html, "996");

    expect(detail?.name).toBe("未来都市NO.6");
    expect(detail?.author).toBe("浅野敦子");
    expect(detail?.status).toBe("已完结");
    expect(detail?.updateTime).toBe("2013-08-24");
    expect(detail?.wordCount).toBe("574996字");
    expect(detail?.tags).toBe("科幻 青春 冒险 耽美");
    expect(detail?.latestChapter).toBe("第九卷 插图");
    expect(detail?.brief).toBe(
      "这是一段小说简介正文，通常比较长，用于确认简介解析正确。\n第二行简介内容。\n第三行简介内容。",
    );
    expect(detail?.cover).toBe("http://img.wenku8.com/image/0/996/996s.jpg");
  });

  test("解析热榜", () => {
    const html = `
      <html><body><div id="right">
        <div class="block"><div class="blockcontent"><ul>
          <li><a href="/book/4469.htm" title="远海事件">远海事件</a></li>
          <li><a href="/book/996.htm" title="未来都市">未来都市</a></li>
        </ul></div></div>
      </div></body></html>`;

    const items = parseRankingPage(html, "hot");
    expect(items).toEqual([
      { id: "4469", name: "远海事件", author: "" },
      { id: "996", name: "未来都市", author: "" },
    ]);
  });

  test("解析搜索结果列表", () => {
    const html = `
      <html><body><div id="centerm"><div id="content">
        <table class="grid">
          <caption>搜索结果</caption>
          <tr><td>
            <div class="novel">
              <div><a href="/book/4469.htm"><img src="/image/4/4469/4469s.jpg" /></a></div>
              <div>
                <b>远海事件</b>
                <p>作者：咏坂雄二</p>
                <p></p>
                <p><span>悬疑 黑暗 犯罪</span></p>
                <p>简介内容</p>
              </div>
            </div>
          </td></tr>
        </table>
      </div></div></body></html>`;

    const items = parseSearchPage(
      html,
      "https://www.wenku8.net/modules/article/search.php?searchkey=x",
      "远海",
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("4469");
    expect(items[0]?.name).toBe("远海事件");
    expect(items[0]?.author).toBe("咏坂雄二");
    expect(items[0]?.tags).toBe("悬疑 黑暗 犯罪");
    expect(items[0]?.cover).toBe("https://www.wenku8.net/image/4/4469/4469s.jpg");
  });
});
