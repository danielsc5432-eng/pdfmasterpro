import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/processing/prepare/route";

test("preparation refuses foreign origins, skips direct tools and shares native startup", async () => {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  process.env.APP_PUBLIC_ORIGIN = "https://www.arquivelio.com.br";
  process.env.VERCEL = "1";
  process.env.PROCESSING_WORKER_URL = "https://prepare-test.invalid";
  delete process.env.PROCESSING_WORKER_ONLY;
  delete process.env.PROCESSING_WORKER_ROUTES;
  delete process.env.PROCESSING_FAST_LOCAL;
  let calls = 0;
  globalThis.fetch = (async (url, options) => {
    calls++;
    assert.equal(url, "https://prepare-test.invalid/api/health");
    assert.equal(options?.body, undefined);
    assert.equal(options?.headers, undefined);
    assert.equal(options?.redirect, "error");
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  const request = (tool: string, origin = "https://www.arquivelio.com.br", bytes = 1000) => new NextRequest("https://www.arquivelio.com.br/api/processing/prepare", { method: "POST", headers: { origin }, body: JSON.stringify({ tool, bytes }) });
  try {
    assert.equal((await POST(request("ocr-pdf", "https://foreign.invalid"))).status, 403);
    assert.equal((await POST(request("unknown"))).status, 400);
    assert.equal((await POST(request("ocr-pdf", undefined, 0))).status, 400);
    assert.equal((await POST(request("girar-pdf"))).status, 200);
    assert.equal(calls, 0);
    const responses = await Promise.all([POST(request("ocr-pdf")), POST(request("pdf-para-word"))]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.equal(calls, 1);
    assert.equal((await POST(request("ocr-pdf"))).status, 200);
    assert.equal(calls, 1);
    process.env.PROCESSING_WORKER_URL = "https://user:secret@bad.invalid";
    assert.equal((await POST(request("ocr-pdf"))).status, 503);
    assert.equal(calls, 1);
  } finally { process.env = env; globalThis.fetch = originalFetch; }
});
