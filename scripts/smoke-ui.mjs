import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  assert.equal(await evaluate("document.querySelector('.flagship-cta').getAttribute('href')"), "/ferramentas/detector-divergencias");
  assert.ok(await evaluate("document.querySelector('.comparison-preview').textContent.includes('Exemplo ilustrativo')"));
  assert.ok(await evaluate("document.querySelector('.brand-symbol img').complete && document.querySelector('.brand-symbol img').naturalWidth > 0"));
  for (const width of [320, 390, 768, 920, 1440]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 });
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Home overflow at width " + width);
  }
  if (process.env.SMOKE_SCREENSHOT_DIR) {
    await mkdir(process.env.SMOKE_SCREENSHOT_DIR, { recursive: true });
    for (const [name, width, height, dark] of [["home-desktop", 1440, 1000, false], ["home-mobile", 390, 1100, false], ["home-dark", 1440, 1000, true]]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 700 });
      await evaluate(`document.documentElement.classList.toggle('dark', ${dark}); window.scrollTo(0, 0)`);
      await new Promise(resolve => setTimeout(resolve, 250));
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(process.env.SMOKE_SCREENSHOT_DIR, name + ".png"), Buffer.from(shot.data, "base64"));
    }
    await evaluate("document.documentElement.classList.remove('dark')");
  }
  await cdp("Emulation.clearDeviceMetricsOverride");
  await evaluate("document.querySelector('.flagship-cta').click()");
  await waitFor("!!document.querySelector('.divergence-workspace')");
  console.log("PASS flagship CTA, illustrative demo, supplied logo and responsive homepage");
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

  const comparisonFiles = [];
  for (const amount of ["100,00", "200,00"]) {
    const fixture = await PDFDocument.create();
    const sheet = fixture.addPage([595, 842]);
    ["Contrato: 123", "Nome: Maria Silva", "Total: R$ " + amount, "Clausula 1: O pagamento devera ocorrer em " + (amount === "100,00" ? "dez" : "trinta") + " dias."].forEach((text, index) => sheet.drawText(text, { x: 40, y: 750 - index * 30, size: 12 }));
    const filename = path.join(directory, "comparison-" + amount + ".pdf");
    await writeFile(filename, await fixture.save()); comparisonFiles.push(filename);
  }
  await navigate("/ferramentas/detector-divergencias");
  await selectFiles(comparisonFiles);
  await waitFor("document.querySelectorAll('.divergence-files li').length === 2");
  await evaluate("document.querySelector('.divergence-actions .button-primary').click()");
  await waitFor("document.querySelectorAll('.divergence-finding').length === 2", 60000);
  assert.ok(await evaluate("document.querySelector('.divergence-evidence').textContent.includes('100,00') && document.querySelector('.divergence-evidence').textContent.includes('200,00')"));
  assert.equal(await evaluate("document.querySelectorAll('.divergence-evidence a[href*=\"#page=1\"]').length"), 4);
  assert.ok(await evaluate("document.querySelector('.divergence-local-ai button').disabled"), "AI must require explicit download consent");
  if (process.env.SMOKE_LOCAL_AI === "1") {
    await evaluate("document.querySelector('.divergence-local-ai input[type=checkbox]').click()");
    await evaluate("document.querySelector('.divergence-local-ai button').click()");
    await waitFor("!!document.querySelector('.divergence-local-ai ul') || document.querySelector('.divergence-local-ai [role=status]')?.textContent.includes('preservados')", 300000);
    assert.ok(await evaluate("!!document.querySelector('.divergence-local-ai ul')"), await evaluate("document.querySelector('.divergence-local-ai').textContent"));
    assert.match(await evaluate("document.querySelector('.divergence-local-ai li').textContent"), /0\.\d{3}|1\.000/);
    assert.equal(await evaluate("document.querySelectorAll('.divergence-finding').length"), 2);
    console.log("PASS real multilingual MiniLM inference inside browser worker; evidence unchanged");
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Comparison results overflow on mobile");
  await cdp("Emulation.clearDeviceMetricsOverride");
  await evaluate("(()=>{ const select=document.querySelector('.divergence-finding select'); select.value='confirmed'; select.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await waitFor("document.querySelector('.divergence-finding select').value === 'confirmed'");
  await evaluate("(()=>{const original=HTMLAnchorElement.prototype.click;window.__report=null;HTMLAnchorElement.prototype.click=function(){if(this.download==='relatorio-divergencias.pdf'){window.__report=fetch(this.href).then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)));HTMLAnchorElement.prototype.click=original;}else original.call(this);};document.querySelector('.divergence-actions .button-primary').click();})()");
  await waitFor("window.__report !== null", 30000);
  const reportBytes = new Uint8Array(await evaluate("window.__report"));
  assert.ok((await PDFDocument.load(reportBytes)).getPageCount() >= 1);
  console.log("PASS comparison upload, real evidence, source links, human review and PDF report");

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
  for (const route of ["/", "/ferramentas", "/ferramentas/juntar-pdf", "/ferramentas/detector-divergencias", "/precos"]) { await navigate(route); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Horizontal overflow on " + route); }
  await evaluate("document.querySelector('.mobile-toggle').click()");
  await waitFor("document.querySelector('.mobile-toggle').getAttribute('aria-expanded') === 'true'");
  console.log("PASS mobile layout on five routes and mobile menu");
  assert.deepEqual(errors, [], "Uncaught browser exceptions");
  console.log("PASS no uncaught browser exceptions");
  await send("Browser.close").catch(() => undefined);
} finally {
  socket?.close();
  if (child.exitCode === null) { child.kill(); await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]); }
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
