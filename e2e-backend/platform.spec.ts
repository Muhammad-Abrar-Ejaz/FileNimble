import { test, expect } from "@playwright/test";

test("real same-origin job, signed browser upload/download, ownership and deletion", async ({ page, browser }) => {
  const networkFailures: string[] = [];
  page.on("requestfailed", request => networkFailures.push(new URL(request.url()).origin + ": " + request.failure()?.errorText));
  page.on("console", message => { if (message.type() === "error") networkFailures.push(message.text().replace(/https?:\/\/\S+/g, "[URL]")); });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const bytes = new TextEncoder().encode("%FN-FIXTURE\nbrowser evidence");
    const created = await fetch("/api/v1/jobs", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ tool: "__fixture__", files: [{ name: "browser.fixture", size: bytes.length, type: "application/octet-stream" }] }),
    });
    if (created.status !== 201) throw new Error("Job creation failed: " + created.status);
    const job = await created.json();
    const uploaded = await fetch(job.uploads[0].url, { method: "PUT", headers: job.uploads[0].headers, body: bytes });
    if (uploaded.status !== 200) throw new Error("Signed browser upload failed: " + uploaded.status);
    const path = "/api/v1/jobs/" + job.jobId;
    const finalized = await fetch(path + "/complete-upload", { method: "POST" });
    if (!finalized.ok) throw new Error("Finalization failed");
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const response = await fetch(path);
      const status = await response.json();
      if (status.state === "COMPLETED") {
        const authorized = await fetch(path + "/download-token", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: status.files[0].fileId }),
        });
        const token = await authorized.json();
        if (!token.url || !["localhost", "127.0.0.1"].includes(new URL(token.url).hostname)) throw new Error("Signed download endpoint is not browser-reachable");
        const download = await fetch(token.url);
        return { jobId: job.jobId, fileId: status.files[0].fileId, content: await download.text(), cache: response.headers.get("cache-control"), robots: response.headers.get("x-robots-tag"), cookieVisible: document.cookie.includes("fn_session") };
      }
      if (["FAILED", "EXPIRED", "CANCELLED"].includes(status.state)) throw new Error("Job failed: " + status.error);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error("Job timed out");
  }).catch(error => { throw new Error(String(error).replace(/https?:\/\/\S+/g, "[URL]") + " " + networkFailures.join("; ")); });
  expect(result.content).toBe("%FN-RESULT\nBROWSER EVIDENCE");
  expect(result.cache).toBe("no-store");
  expect(result.robots).toContain("noindex");
  expect(result.cookieVisible).toBe(false);
  const cookie = (await page.context().cookies()).find(value => value.name === "fn_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");

  const other = await browser.newContext();
  try {
    const inaccessible = await other.request.get("http://localhost:3100/api/v1/jobs/" + result.jobId);
    expect(inaccessible.status()).toBe(401);
  } finally { await other.close(); }
  const denied = await page.request.post("/api/v1/jobs/" + result.jobId + "/cancel", { headers: { Origin: "https://attacker.invalid" } });
  expect(denied.status()).toBe(403);
  const deleted = await page.request.delete("/api/v1/jobs/" + result.jobId, { headers: { Origin: "http://localhost:3100" } });
  expect(deleted.status()).toBe(200);
  const token = await page.request.post("/api/v1/jobs/" + result.jobId + "/download-token", { headers: { Origin: "http://localhost:3100" }, data: { fileId: result.fileId } });
  expect(token.status()).toBe(410);
});

test("fixture is not public and browser converters cannot create server jobs", async ({ request }) => {
  const tools = await request.get("/api/v1/tools");
  expect(tools.ok()).toBe(true);
  const records = await tools.json();
  expect(records.some((record: {slug: string}) => record.slug === "__fixture__")).toBe(false);
  expect(new Set(records.map((record: {slug: string}) => record.slug)).size).toBe(records.length);
  const rejected = await request.post("/api/v1/jobs", {
    headers: { Origin: "http://localhost:3100", "Idempotency-Key": crypto.randomUUID() },
    data: { tool: "pdf-to-jpg", files: [{ name: "x.fixture", size: 12, type: "application/octet-stream" }] },
  });
  expect(rejected.status()).toBe(400);
  expect((await rejected.json()).error).toBe("UNSUPPORTED_FORMAT");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("__fixture__");
});
