import { createHmac } from "node:crypto";

/** 默认版本号。 */
export const DEFAULT_VER = "1.30";

/**
 * 每个构建写死在 native 层的 flavor。
 * 版本与 flavor 必须配对，否则服务端直接返回 `400 Bad request.`。
 */
export const BUILD_FLAVORS: Readonly<Record<string, string>> = {
  "1.25": "chibi-chapter",
  "1.30": "digital-bento",
  "1.32": "nano-mewx",
};

export const DEFAULT_FLAVOR = BUILD_FLAVORS[DEFAULT_VER] ?? "digital-bento";

export class AppVerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppVerError";
  }
}

/** 已知版本直接查表；未知版本必须显式提供 flavor。 */
export function resolveFlavor(ver: string, explicit?: string): string {
  if (explicit) return explicit;

  const flavor = BUILD_FLAVORS[ver];
  if (!flavor) {
    const known = Object.entries(BUILD_FLAVORS)
      .map(([version, value]) => `${version}=${value}`)
      .join("、");
    throw new AppVerError(`未知的版本 ${ver}，请在 wenku8.json 的 app.flavor 中显式指定（已知：${known}）`);
  }
  return flavor;
}

export interface AppverInput {
  ver?: string;
  flavor?: string;
  /** 毫秒时间戳，默认当前时间。 */
  nowMs?: number;
}

export interface AppverDebug extends Required<Omit<AppverInput, "flavor" | "nowMs">> {
  flavor: string;
  nowMs: number;
  minutes: number;
  message: string;
  digest: string;
  appver: string;
}

/**
 * 签名每 60 秒变化一次；同一分钟内结果稳定。
 */
export function magicAppver(input: AppverInput = {}): string {
  return magicDebug(input).appver;
}

export function magicDebug(input: AppverInput = {}): AppverDebug {
  const ver = input.ver ?? DEFAULT_VER;
  const flavor = resolveFlavor(ver, input.flavor);
  const nowMs = input.nowMs ?? Date.now();
  const minutes = Math.floor(nowMs / 1000 / 60);
  const message = `${ver}|${flavor}|${minutes}`;
  const digest = createHmac("sha256", flavor).update(message, "utf8").digest("hex");

  return {
    ver,
    flavor,
    nowMs,
    minutes,
    message,
    digest,
    appver: `${ver}-${flavor}-${digest.slice(12, 20)}`,
  };
}
