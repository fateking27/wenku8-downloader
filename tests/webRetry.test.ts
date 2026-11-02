import { afterEach, describe, expect, test } from "bun:test";
import { webGet } from "../src/http/web";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(handler: (call: number) => Response): () => number {
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return handler(calls);
  }) as unknown as typeof fetch;

  return () => calls;
}

describe("网页请求重试策略", () => {
  test("连续 403 时共请求 5 次后才返回", async () => {
    const calls = mockFetch(() => new Response("blocked", { status: 403 }));

    const page = await webGet("https://www.wenku8.net/__retry_test__", { retryDelayMs: 0 });

    expect(calls()).toBe(5);
    expect(page.status).toBe(403);
  });

  test("第 5 次成功则直接使用结果", async () => {
    const calls = mockFetch((call) =>
      call < 5 ? new Response("blocked", { status: 403 }) : new Response("<html>ok</html>", { status: 200 }),
    );

    const page = await webGet("https://www.wenku8.net/__retry_test__", { retryDelayMs: 0 });

    expect(calls()).toBe(5);
    expect(page.status).toBe(200);
    expect(page.html).toContain("ok");
  });

  test("404 是确定结果，不重复请求", async () => {
    const calls = mockFetch(() => new Response("not found", { status: 404 }));

    const page = await webGet("https://www.wenku8.net/__retry_test__", { retryDelayMs: 0 });

    expect(calls()).toBe(1);
    expect(page.status).toBe(404);
  });
});
