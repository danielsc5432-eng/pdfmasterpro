import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import type { LayoutPage } from "./layout";
import type { PdfVectorPage } from "./vector";
import { commandExists, execFile } from "./system";

function color(value: string) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

/** Only borders and fills are rendered: every text item remains editable in Word. */
export async function renderDocxArtwork(pages: LayoutPage[], vectors: PdfVectorPage[], directory: string): Promise<Map<number, Uint8Array>> {
  const output = new Map<number, Uint8Array>();
  const selected = vectors.map((page, index) => ({ page, index })).filter(({ page }) => page.lines.length || page.rects.length);
  if (!selected.length) return output;
  const renderer = process.env.PDF_RENDERER || "pdftoppm";
  if (!(await commandExists(renderer))) throw new Error("O renderizador PDF não está configurado para preservar as bordas do documento Word.");
  const document = await PDFDocument.create();
  for (const { page: graphics, index } of selected) {
    const size = pages[index];
    const page = document.addPage([size.width, size.height]);
    for (const rect of graphics.rects) {
      page.drawRectangle({ x: rect.x, y: size.height - rect.y - rect.h, width: rect.w, height: rect.h, borderWidth: rect.strokeWidth, borderColor: color(rect.strokeColor), ...(rect.filled && rect.fillColor ? { color: color(rect.fillColor) } : { opacity: 0 }) });
    }
    // Duplicate cell edges are common in report exports. Paint each only once.
    const seen = new Set<string>();
    for (const line of graphics.lines) {
      const endpoints = [[line.x1, line.y1], [line.x2, line.y2]].map((point) => point.map((value) => value.toFixed(2)).join(",")).sort();
      const key = endpoints.join(":") + ":" + line.width + ":" + line.color;
      if (seen.has(key)) continue;
      seen.add(key);
      page.drawLine({ start: { x: line.x1, y: size.height - line.y1 }, end: { x: line.x2, y: size.height - line.y2 }, thickness: line.width, color: color(line.color) });
    }
  }
  const input = path.join(directory, "artwork.pdf");
  const prefix = path.join(directory, "artwork-page");
  await writeFile(input, await document.save());
  await execFile(renderer, ["-png", "-r", "144", input, prefix], { timeout: 180000, windowsHide: true });
  const files = (await readdir(directory)).filter((file) => /^artwork-page-\d+\.png$/.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length !== selected.length) throw new Error("O renderizador não preservou todas as páginas gráficas do documento Word.");
  for (let index = 0; index < files.length; index++) output.set(selected[index].index, new Uint8Array(await readFile(path.join(directory, files[index]))));
  return output;
}
