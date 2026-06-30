export declare const defaultAllowedAttributes: string[];
export declare const defaultAllowedXhtml11Tags: string[];
export interface EpubContentOptions {
    title: string;
    data: string;
    url?: string;
    author?: Array<string> | string;
    filename?: string;
    excludeFromToc?: boolean;
    beforeToc?: boolean;
}
export interface EpubOptions {
    title: string;
    description: string;
    cover?: string;
    useFirstImageAsCover?: boolean;
    downloadAudioVideoFiles?: boolean;
    publisher?: string;
    collection?: EpubCollection | EpubCollection[];
    author?: Array<string> | string;
    tocTitle?: string;
    appendChapterTitles?: boolean;
    hideToC?: boolean;
    date?: string;
    lang?: string;
    css?: string;
    fonts?: Array<string>;
    content: Array<EpubContentOptions>;
    customOpfTemplatePath?: string;
    customNcxTocTemplatePath?: string;
    customHtmlTocTemplatePath?: string;
    customHtmlCoverTemplatePath?: string;
    version?: number;
    userAgent?: string;
    verbose?: boolean;
    tempDir?: string;
    allowedAttributes?: string[];
    allowedXhtml11Tags?: string[];
}
interface EpubContent {
    id: string;
    href: string;
    title: string;
    data: string;
    url: string | null;
    author: Array<string>;
    filePath: string;
    templatePath: string;
    excludeFromToc: boolean;
    beforeToc: boolean;
    isCover: boolean;
}
interface EpubMedia {
    id: string;
    url: string;
    dir: string;
    mediaType: string;
    extension: string;
    isCoverImage?: boolean;
}
interface EpubCollection {
    name: string;
    type?: "series" | "set";
    position?: number;
}
export declare class EPub {
    uuid: string;
    title: string;
    description: string;
    cover: string | null;
    collections: EpubCollection[];
    useFirstImageAsCover: boolean;
    downloadAudioVideoFiles: boolean;
    coverMediaType: string | null;
    coverExtension: string | null;
    coverDimensions: {
        width: number;
        height: number;
    };
    publisher: string;
    author: Array<string>;
    tocTitle: string;
    appendChapterTitles: boolean;
    showToC: boolean;
    date: string;
    lang: string;
    css: string | null;
    fonts: Array<string>;
    content: Array<EpubContent>;
    images: Array<EpubMedia>;
    audioVideo: Array<EpubMedia>;
    customOpfTemplatePath: string | null;
    customNcxTocTemplatePath: string | null;
    customHtmlCoverTemplatePath: string | null;
    customHtmlTocTemplatePath: string | null;
    version: number;
    userAgent: string;
    verbose: boolean;
    tempDir: string;
    tempEpubDir: string;
    output: string;
    allowedAttributes: string[];
    allowedXhtml11Tags: string[];
    coverMetaContent: string | null;
    startOfContentHref: string;
    constructor(options: EpubOptions, output: string);
    private validateElement;
    private processMediaTag;
    render(): Promise<{
        result: string;
    }>;
    private generateTemplateFiles;
    private makeCover;
    private downloadMedia;
    private downloadAllMedia;
    private generate;
}
export {};
