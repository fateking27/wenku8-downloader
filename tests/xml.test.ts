import { describe, expect, test } from "bun:test";
import { childAttr, childElements, dataMap, findElement, parseXml, textOf } from "../src/app/xml";

describe("App 中继 XML 解析", () => {
  test("解析分卷目录（CDATA + 嵌套章节）", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<package>
<volume vid="28988"><![CDATA[第一卷]]>
<chapter cid="28989"><![CDATA[人物介绍]]></chapter>
<chapter cid="28990"><![CDATA[1、湿漉漉的老鼠]]></chapter>
</volume>
</package>`;

    const root = parseXml(xml);
    expect(root?.tag).toBe("package");

    const volumes = childElements(root, "volume");
    expect(volumes).toHaveLength(1);
    expect(volumes[0]?.attrs["vid"]).toBe("28988");
    expect(textOf(volumes[0] ?? null)).toBe("第一卷");

    const chapters = childElements(volumes[0] ?? null, "chapter");
    expect(chapters).toHaveLength(2);
    expect(chapters[1]?.attrs["cid"]).toBe("28990");
    expect(textOf(chapters[1] ?? null)).toBe("1、湿漉漉的老鼠");
  });

  test("解析元数据（自闭合标签 + CDATA + 属性）", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<metadata>
<data name="Title" aid="4469"><![CDATA[远海事件]]></data>
<data name="Author" value="咏坂雄二"/>
<data name="Tags" value="悬疑 &amp; 黑暗"/>
</metadata>`;

    const root = parseXml(xml);
    expect(findElement(root, "metadata")?.tag).toBe("metadata");

    const data = dataMap(root);
    expect(data["Title"]).toBe("远海事件");
    expect(data["Author"]).toBe("咏坂雄二");
    expect(data["Tags"]).toBe("悬疑 & 黑暗");
  });

  test("列表项属性与 childAttr", () => {
    const xml = `<result><page num="430"/><item aid="1973"><data name="Title" value="测试"/></item></result>`;
    const root = parseXml(xml);
    expect(childAttr(root, "page", "num")).toBe("430");
    expect(childElements(root, "item")[0]?.attrs["aid"]).toBe("1973");
  });

  test("纯文本响应不算 XML", () => {
    expect(parseXml("4")).toBeNull();
    expect(parseXml("Bad request.")).toBeNull();
  });
});
