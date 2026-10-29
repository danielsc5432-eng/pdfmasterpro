import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/v1/process/route";
import { signPlanHeaders } from "../../lib/billing/plan-token";

test("seven direct PDF tools produce valid results without contacting the native worker", async () => {
  const previousEnv = { ...process.env }, previousFetch = globalThis.fetch;
  process.env.VERCEL = "1";
  process.env.BILLING_SIGNING_SECRET = "synthetic-direct-processing-secret";
  process.env.PROCESSING_WORKER_URL = "https://must-not-be-contacted.invalid";
  delete process.env.DATABASE_URL;
  delete process.env.PROCESSING_WORKER_ONLY;
  delete process.env.PROCESSING_WORKER_ROUTES;
  delete process.env.PROCESSING_FAST_LOCAL;
  globalThis.fetch = (async () => { assert.fail("Native worker must not be contacted"); }) as typeof fetch;
  try {
    const source = await PDFDocument.create();
    source.addPage([400, 560]); source.addPage([500, 600]);
    const bytes = await source.save();
    for (const tool of ["juntar-pdf", "dividir-pdf", "girar-pdf", "organizar-pdf", "editar-metadados", "marca-dagua", "numerar-paginas"]) {
      const form = new FormData();
      form.append("files", new Blob([bytes as BlobPart], { type: "application/pdf" }), "synthetic.pdf");
      if (tool === "juntar-pdf") form.append("files", new Blob([bytes as BlobPart], { type: "application/pdf" }), "second.pdf");
      for (const [name, value] of Object.entries({ angle: "90", order: "2,1", title: "Direct test", text: "TEST", start: "1", end: "1" })) form.append(name, value);
      const prepared = new Request("http://localhost/api/v1/process", { method: "POST", body: form });
      const body = await prepared.arrayBuffer();
      const headers = new Headers(prepared.headers);
      headers.set("content-length", String(body.byteLength));
      for (const [name, value] of Object.entries(signPlanHeaders("free")!)) headers.set(name, value);
      const response = await POST(new NextRequest(`http://localhost/api/v1/process?tool=${tool}`, { method: "POST", headers, body }));
      assert.equal(response.status, 200, tool + ": " + (response.status === 200 ? "" : await response.text()));
      assert.equal(response.headers.get("x-arquivelio-processing"), "direct");
      const output = await PDFDocument.load(await response.arrayBuffer());
      assert.equal(output.getPageCount(), tool === "juntar-pdf" ? 4 : tool === "dividir-pdf" ? 1 : 2);
      if (tool === "girar-pdf") assert.equal(output.getPage(0).getRotation().angle, 90);
      if (tool === "organizar-pdf") assert.equal(output.getPage(0).getWidth(), 500);
      if (tool === "editar-metadados") assert.equal(output.getTitle(), "Direct test");
    }
  } finally { process.env = previousEnv; globalThis.fetch = previousFetch; }
});
