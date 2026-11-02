/**
 * 面向数据接口响应的极简 XML 解析器。
 *
 * 服务端大量使用 `<![CDATA[...]]>`，且存在 `<data value="..."/>` 这种自闭合标签，
 * 因此不能按普通标签的正则顺序处理：CDATA 必须优先匹配。
 */

export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const parsed = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }
    if (code.startsWith("#")) {
      const parsed = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

const TOKEN_PATTERN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\/([A-Za-z_][\w.:-]*)\s*>|([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;

/** 解析 XML，返回根元素；纯文本响应返回 null。 */
export function parseXml(xml: string): XmlNode | null {
  const source = xml.replace(/^\uFEFF/, "").replace(/<\?xml[^>]*\?>/g, "");
  const root: XmlNode = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];

  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    const [raw, cdata, closeTag, openTag, attrText, selfClose, text] = match;

    if (cdata !== undefined) {
      stack[stack.length - 1]!.text += cdata;
      continue;
    }
    if (raw.startsWith("<!--")) continue;

    if (closeTag !== undefined) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (openTag === undefined) {
      const plain = text ?? "";
      if (plain.trim()) stack[stack.length - 1]!.text += plain;
      continue;
    }

    const node: XmlNode = { tag: openTag, attrs: {}, children: [], text: "" };
    if (attrText) {
      for (const attribute of attrText.matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        node.attrs[attribute[1]!] = decodeEntities(attribute[2] ?? attribute[3] ?? "");
      }
    }

    stack[stack.length - 1]!.children.push(node);
    if (selfClose !== "/") stack.push(node);
  }

  return root.children[0] ?? null;
}

export function childElements(node: XmlNode | null, tag: string): XmlNode[] {
  return node ? node.children.filter((child) => child.tag === tag) : [];
}

export function firstChild(node: XmlNode | null, tag: string): XmlNode | null {
  return node ? (node.children.find((child) => child.tag === tag) ?? null) : null;
}

export function childText(node: XmlNode | null, tag: string): string {
  return firstChild(node, tag)?.text.trim() ?? "";
}

export function childAttr(node: XmlNode | null, tag: string, attr: string): string | null {
  return firstChild(node, tag)?.attrs[attr] ?? null;
}

export function findElement(node: XmlNode | null, tag: string): XmlNode | null {
  if (!node) return null;
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const hit = findElement(child, tag);
    if (hit) return hit;
  }
  return null;
}

export function textOf(node: XmlNode | null): string {
  return node?.text.trim() ?? "";
}

/** `<metadata><data name="X" value="Y"/>...</metadata>` → `{X: Y}`。 */
export function dataMap(node: XmlNode | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const data of childElements(node, "data")) {
    const name = data.attrs["name"];
    if (!name) continue;
    result[name] = data.text.trim() || data.attrs["value"] || "";
  }
  return result;
}
