// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { backendProxy } from "./backendProxy";

const id = "12345678-1234-1234-1234-123456789012";
function request(method = "GET", body?: string, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/v1/jobs", {
    method, headers: { origin, cookie: "fn_session=opaque; unrelated=private", "idempotency-key": "request-key", "x-forwarded-for": "spoofed" },
    ...(body === undefined ? {} : { body }),
  });
}
describe("same-origin backend boundary", () => {
  beforeEach(() => {
    vi.stubEnv("CONVERSION_API_URL", "http://127.0.0.1:8000");
    vi.stubEnv("CONVERSION_API_SECRET", "test-only-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("rejects unconfigured backend without affecting browser routes", async () => {
    vi.stubEnv("CONVERSION_API_URL", "");
    expect((await backendProxy(request(), ["jobs", id])).status).toBe(503);
  });
  it("rejects paths outside the allowlist", async () => {
    expect((await backendProxy(request(), ["..", "metrics"])).status).toBe(404);
    expect((await backendProxy(request(), ["metrics"])).status).toBe(404);
  });
  it("rejects cross-origin mutations before any upstream request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await backendProxy(request("POST", "{}", "https://attacker.invalid"), ["jobs"])).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds metadata body bytes", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await backendProxy(request("POST", "x".repeat(16385)), ["jobs"])).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("allows only the explicit AI endpoints with a separate bounded text body", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"enabled":false}', { status: 200 })));
    vi.stubGlobal("fetch", fetcher);
    const status = await backendProxy(request(), ["ai", "status"]);
    expect(status.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/v1/ai/status");

    const accepted = await backendProxy(request("POST", "x".repeat(20_000)), ["ai", "process"]);
    expect(accepted.status).toBe(200);
    expect(fetcher.mock.calls[1][0]).toBe("http://127.0.0.1:8000/api/v1/ai/process");

    const oversized = await backendProxy(request("POST", "x".repeat(50 * 1024 + 1)), ["ai", "process"]);
    expect(oversized.status).toBe(413);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await backendProxy(request(), ["ai", "unknown"])).status).toBe(404);
  });
  it("forwards only scoped authentication and preserves no-store and session cookie", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"state":"UPLOADING"}', { status: 201, headers: { "set-cookie": "fn_session=new; HttpOnly; SameSite=Strict; Path=/api/v1" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await backendProxy(request("POST", '{"tool":"__fixture__"}'), ["jobs"]);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/jobs");
    expect(options.headers.get("x-internal-key")).toBe("test-only-secret");
    expect(options.headers.get("cookie")).toBe("fn_session=opaque");
    expect(options.headers.get("x-client-ip")).toBe("local");
    expect(options.headers.get("x-forwarded-for")).toBeNull();
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
  });
  it("redacts upstream connection errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive connection details")));
    const response = await backendProxy(request(), ["jobs", id]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
});
