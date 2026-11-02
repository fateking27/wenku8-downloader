declare module "html-to-text" {
  export interface HtmlToTextSelector {
    selector: string;
    format?: string;
    options?: Record<string, unknown>;
  }

  export interface HtmlToTextOptions {
    wordwrap?: number | false | null;
    ignoreHref?: boolean;
    ignoreImage?: boolean;
    preserveNewlines?: boolean;
    selectors?: HtmlToTextSelector[];
    uppercaseHeadings?: boolean;
    singleNewLineParagraphs?: boolean;
  }

  export function htmlToText(html: string, options?: HtmlToTextOptions): string;
  export function convert(html: string, options?: HtmlToTextOptions): string;
}
