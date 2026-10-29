import test from "node:test";
import assert from "node:assert/strict";
import { useDirectProcessing, DIRECT_REQUEST_BYTES } from "../../lib/processing/fast-local";

test("only small pure-JavaScript tasks execute directly on Vercel", () => {
  for (const tool of ["juntar-pdf", "dividir-pdf", "girar-pdf", "organizar-pdf", "editar-metadados", "marca-dagua", "numerar-paginas"]) {
    assert.equal(useDirectProcessing(tool, 1024, { VERCEL: "1" }), true);
  }
  for (const tool of ["pdf-para-word", "word-para-pdf", "ocr-pdf", "comprimir-pdf", "resumir-pdf-ia", "detector-divergencias", "unknown"]) {
    assert.equal(useDirectProcessing(tool, 1024, { VERCEL: "1" }), false);
  }
});

test("unknown size, large uploads and native workers preserve the old path", () => {
  for (const bytes of [0, -1, NaN, Infinity, 1.5, DIRECT_REQUEST_BYTES + 1]) assert.equal(useDirectProcessing("girar-pdf", bytes, { VERCEL: "1" }), false);
  assert.equal(useDirectProcessing("girar-pdf", DIRECT_REQUEST_BYTES, { VERCEL: "1" }), true);
  for (const env of [{}, { VERCEL: "1", PROCESSING_FAST_LOCAL: "0" }, { VERCEL: "1", PROCESSING_WORKER_ONLY: "1" }, { VERCEL: "1", PROCESSING_WORKER_ROUTES: "{}" }]) {
    assert.equal(useDirectProcessing("girar-pdf", 1024, env), false);
  }
});
