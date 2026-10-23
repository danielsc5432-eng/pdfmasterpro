import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

// Uses an installed Chromium browser, without adding a browser automation dependency.
const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";
const candidates = [process.env.SMOKE_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error("Set SMOKE_BROWSER to an installed Chromium executable.");
const directory = await mkdtemp(path.join(os.tmpdir(), "pdfmaster-ui-"));
const child = spawn(executable, ["--headless=new", "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${path.join(directory, "profile")}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Browser startup timed out")), 20000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.stderr.on("data", (data) => { output += data; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  socket = new WebSocket(endpoint);
  await once(socket, "open");
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error("CDP timeout: " + method)); }, 15000); pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params, sessionId })); });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  const evaluate = async (expression) => { const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitFor = async (expression, timeout = 15000) => { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 150)); } throw new Error("UI timeout: " + expression + "\n" + await evaluate("document.body.innerText.slice(-1500)")); };
  const navigate = async (route) => { await cdp("Page.navigate", { url: base + route }); await waitFor("document.readyState === 'complete' && !!document.querySelector('header')"); await new Promise((resolve) => setTimeout(resolve, 400)); };
  const selectFiles = async (files) => { const { root } = await cdp("DOM.getDocument"); const { nodeId } = await cdp("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' }); assert.ok(nodeId, "File input missing"); await cdp("DOM.setFileInputFiles", { nodeId, files }); };
  const pdf = await PDFDocument.create(); pdf.addPage([400, 560]).drawText("Browser test PDF", { x: 40, y: 500 });
  const fileA = path.join(directory, "first.pdf"), fileB = path.join(directory, "second.pdf");
  await writeFile(fileA, await pdf.save()); await writeFile(fileB, await pdf.save());

  await navigate("/");
  await selectFiles([fileA, fileB]);
  await waitFor("!!document.querySelector('.upload-card a.button')");
  await evaluate("document.querySelector('.upload-card a.button').click()");
  await waitFor("document.querySelectorAll('.file-row').length === 2");
  console.log("PASS home selection survives navigation");
  await evaluate("document.querySelectorAll('.file-row')[1].querySelector('button').click()");
  await waitFor("document.querySelector('.file-row-name').textContent === 'second.pdf'");
  console.log("PASS merge file reordering");
  await evaluate("document.querySelector('.workspace-actions button').click()");
  await waitFor("!!document.querySelector('a[download]')");
  const download = await evaluate("(async () => { const a=document.querySelector('a[download]'); return { name:a.download, bytes:Array.from(new Uint8Array(await (await fetch(a.href)).arrayBuffer())) }; })()");
  assert.equal((await PDFDocument.load(new Uint8Array(download.bytes))).getPageCount(), 2);
  assert.match(download.name, /\.pdf$/);
  console.log("PASS merge result downloadable as a valid two-page PDF");

  await navigate("/ferramentas/girar-pdf");
  await selectFiles([fileA]); await waitFor("document.querySelectorAll('.file-row').length === 1");
  await selectFiles([fileB]); await waitFor("document.querySelector('.file-row-name').textContent === 'second.pdf'");
  assert.equal(await evaluate("document.querySelectorAll('.file-row').length"), 1);
  await evaluate("document.querySelector('.workspace-actions button').click()");
  await waitFor("!!document.querySelector('a[download]')");
  const rotated = await evaluate("(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('a[download]').href)).arrayBuffer())))()");
  assert.equal((await PDFDocument.load(new Uint8Array(rotated))).getPage(0).getRotation().angle, 90);
  console.log("PASS single-file replacement and rotation");
  await evaluate("document.querySelector('.file-row button').click()");
  await selectFiles([fileB]); await waitFor("document.querySelectorAll('.file-row').length === 1");
  console.log("PASS selecting the same file after removal");

  await navigate("/ferramentas/juntar-pdf");
  await selectFiles([fileA, fileB, fileA, fileB, fileA, fileB]);
  await waitFor("!!document.querySelector('.alert-error')");
  assert.equal(await evaluate("document.querySelectorAll('.file-row').length"), 0);
  console.log("PASS excess files rejected visibly");

  for (const slug of ["ocr-pdf", "redigir-pdf"]) { await navigate("/ferramentas/" + slug); await waitFor("document.querySelector('.workspace').textContent.includes('exclusiva do Premium')"); console.log("PASS guest Premium gating: " + slug); }
  await navigate("/precos");
  await evaluate("document.querySelector('.billing-toggle button').click()");
  await waitFor("document.querySelector('.billing-toggle button').classList.contains('active')");
  assert.match(await evaluate("document.querySelector('.plan-card.featured .plan-price').textContent"), /19,90/);
  console.log("PASS monthly pricing toggle");
  await evaluate("document.querySelector('[aria-label=\"Usar tema escuro\"]')?.click()");
  await waitFor("document.documentElement.classList.contains('dark')");
  console.log("PASS theme switching");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const route of ["/", "/ferramentas", "/ferramentas/juntar-pdf", "/precos"]) { await navigate(route); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Horizontal overflow on " + route); }
  await evaluate("document.querySelector('.mobile-toggle').click()");
  await waitFor("document.querySelector('.mobile-toggle').getAttribute('aria-expanded') === 'true'");
  console.log("PASS mobile layout on four routes and mobile menu");
  assert.deepEqual(errors, [], "Uncaught browser exceptions");
  console.log("PASS no uncaught browser exceptions");
  await send("Browser.close").catch(() => undefined);
} finally {
  socket?.close();
  if (child.exitCode === null) { child.kill(); await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]); }
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
