import { afterEach, describe, expect, test } from "bun:test";
import { wenku8Login } from "../src/http/web";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockLogin(handler: (call: number) => Response): () => number {
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return handler(calls);
  }) as unknown as typeof fetch;

  return () => calls;
}

const FAILED_BODY = "密码错误";

describe("登录重试策略", () => {
  test("连续失败 5 次后返回 false", async () => {
    const calls = mockLogin(
      () =>
        new Response(FAILED_BODY, {
          status: 200,
          headers: { "set-cookie": "PHPSESSID=guest; path=/" },
        }),
    );

    const ok = await wenku8Login({
      username: "tester",
      password: "wrong",
      attempts: 5,
      retryDelayMs: 0,
      persist: false,
    });

    expect(ok).toBe(false);
    expect(calls()).toBe(5);
  });

  test("第 5 次成功则停止重试", async () => {
    const calls = mockLogin((call) =>
      call < 5
        ? new Response(FAILED_BODY, {
            status: 200,
            headers: { "set-cookie": "PHPSESSID=guest; path=/" },
          })
        : new Response("ok", {
            status: 200,
            headers: { "set-cookie": "jieqiUserInfo=uid%3D1; path=/" },
          }),
    );

    const ok = await wenku8Login({
      username: "tester",
      password: "right",
      attempts: 5,
      retryDelayMs: 0,
      persist: false,
    });

    expect(ok).toBe(true);
    expect(calls()).toBe(5);
  });
});
