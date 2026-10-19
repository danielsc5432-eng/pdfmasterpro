import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { Document, FrameAnchorType, FrameWrap, ImageRun, LineRuleType, PageOrientation, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { parseLayout, type LayoutImageItem, type LayoutPage, type LayoutTextItem } from "./layout";
import { pdfToDocxWithMsWord } from "./msword";
import { commandExists, execFile } from "./system";
import { extractPdfVectors, injectVectorShapes, type PdfVectorPage } from "./vector";

export type DocxParagraph = { text: string; pageBreakBefore: boolean; heading: boolean };

const POINTS_TO_TWIPS = 20;
const POINTS_TO_PIXELS = 96 / 72;
const LIST_ITEM = /^([-*•·◦▪]|\d{1,3}[.)]|[a-z][.)])\s+/;
const TERMINATES = /[.!?…:;]$/;

/** Junta as linhas quebradas do `pdftotext` em parágrafos contínuos (modo de reserva). */
export function buildDocxParagraphs(raw: string): DocxParagraph[] {
  const pages = raw.replace(/\r\n?/g, "\n").split("\f");
  if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
  const paragraphs: DocxParagraph[] = [];
  pages.forEach((page, pageIndex) => {
    const collected: string[] = [];
    let current = "";
    const merge = (previous: string, line: string) =>
      /[A-Za-zÀ-ÿ]-$/.test(previous) && /^[a-zà-öø-ÿ]/.test(line) ? previous.slice(0, -1) + line : `${previous} ${line}`;
    for (const rawLine of page.split("\n")) {
      const line = rawLine.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
      if (!line) {
        if (current) { collected.push(current); current = ""; }
        continue;
      }
      if (!current) { current = line; continue; }
      const joins = !LIST_ITEM.test(line) && (/[,\-–—/]$/.test(current) || /^[a-zà-öø-ÿ(«"“']/u.test(line) && !TERMINATES.test(current));
      if (joins) current = merge(current, line);
      else { collected.push(current); current = line; }
    }
    if (current) collected.push(current);
    if (!collected.length) {
      if (pageIndex > 0) paragraphs.push({ text: "", pageBreakBefore: true, heading: false });
      return;
    }
    collected.forEach((text, index) => {
      const heading = text.length <= 70 && !TERMINATES.test(text) && !/[a-zà-öø-ÿ]/.test(text) && /[A-ZÀ-Þ]/.test(text);
      paragraphs.push({ text, pageBreakBefore: index === 0 && pageIndex > 0, heading });
    });
  });
  return paragraphs;
}

function twips(points: number) {
  return Math.max(0, Math.round(points * POINTS_TO_TWIPS));
}

function frameAt(x: number, y: number, width?: number) {
  return {
    type: "absolute" as const,
    position: { x: twips(x), y: twips(y) },
    anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    wrap: FrameWrap.NONE,
    ...(width !== undefined ? { width } : {}),
  };
}

/**
 * Agrupa linhas consecutivas que formam um mesmo parágrafo: mesma coluna (x próximo),
 * mesmo corpo tipográfico e intervalo vertical compatível com quebra de linha.
 * O DOCX resultante flui como parágrafo natural em vez de quadros soltos por linha.
 */
function groupLines(items: LayoutTextItem[]): LayoutTextItem[][] {
  if (items.length <= 1) return items.map((item) => [item]);
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: LayoutTextItem[][] = [];
  let current: LayoutTextItem[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index++) {
    const previous = current[current.length - 1];
    const item = sorted[index];
    const lineHeight = Math.max(previous.font.size, item.font.size) * 1.5;
    const gap = item.y - (previous.y + previous.height);
    const sameColumn = Math.abs(item.x - previous.x) <= Math.max(5, previous.font.size * 0.5);
    const sameFont = Math.abs(item.font.size - previous.font.size) < 0.5;
    const consecutive = gap >= -1 && gap < lineHeight;
    if (sameColumn && sameFont && consecutive) current.push(item);
    else { groups.push(current); current = [item]; }
  }
  groups.push(current);
  return groups;
}

function textParagraph(items: LayoutTextItem[], pageWidth: number) {
  const item = items[0];
  const color = item.font.color.replace("#", "").toUpperCase();
  const size = Math.max(2, Math.round(item.font.size * 2));
  const regular = /^[0-9A-F]{6}$/.test(color) ? color : "000000";
  const threshold = item.font.size * 0.45;
  const hasWideGap = item.words.some((word, index) => {
    if (!index) return false;
    const previous = item.words[index - 1];
    return word.x - (previous.x + previous.width) > threshold && word.x - item.words[0].x > 0;
  });
  const positioned = item.words.length > 1 && hasWideGap && items.length === 1;

  const run = (text: string, bold: boolean, italic: boolean, font = item.font) => new TextRun({
    text,
    font: font.family,
    size: Math.max(2, Math.round(font.size * 2)),
    bold: bold || font.bold,
    italics: italic || font.italic,
    color: (() => { const c = font.color.replace("#", "").toUpperCase(); return /^[0-9A-F]{6}$/.test(c) ? c : "000000"; })(),
  });

  const tabStops: { type: (typeof TabStopType)[keyof typeof TabStopType]; position: number }[] = [];
  const children: TextRun[] = [];

  if (items.length > 1) {
    // Parágrafo multi-linha: renderiza cada linha com quebra, preservando fonte/cor por linha.
    items.forEach((line, lineIndex) => {
      if (lineIndex > 0) children.push(new TextRun({ break: 1, text: "" }));
      const lineColor = line.font.color.replace("#", "").toUpperCase();
      const lineRegular = /^[0-9A-F]{6}$/.test(lineColor) ? lineColor : "000000";
      const lineRun = (text: string, bold: boolean, italic: boolean) => new TextRun({
        text,
        font: line.font.family,
        size: Math.max(2, Math.round(line.font.size * 2)),
        bold: bold || line.font.bold,
        italics: italic || line.font.italic,
        color: lineRegular,
      });
      for (const segment of line.segments.filter((segment) => segment.text)) {
        children.push(lineRun(segment.text, segment.bold, segment.italic));
      }
    });
  } else if (positioned) {
    item.words.forEach((word, index) => {
      if (index > 0) {
        const previous = item.words[index - 1];
        const gap = word.x - (previous.x + previous.width);
        const target = word.x - item.words[0].x;
        if (gap > threshold && target > 0) {
          tabStops.push({ type: TabStopType.LEFT, position: twips(target) });
          children.push(run("\t", false, false));
        } else {
          children.push(run(" ", false, false));
        }
      }
      children.push(run(word.text, word.bold, word.italic));
    });
  } else {
    for (const segment of item.segments.filter((segment) => segment.text)) {
      children.push(run(segment.text, segment.bold, segment.italic));
    }
  }

  // Largura explícita até a borda da página: impede que o Word quebre o texto dentro do quadro.
  const frameWidth = twips(Math.max(item.width + 20, pageWidth - item.x));
  // Espaçamento entre linhas real do PDF (multi-linha) ou aproximado por corpo (linha única).
  const spacing = items.length > 1
    ? (() => {
        const first = items[0];
        const second = items[1];
        const exactTwips = Math.max(40, twips(second.y - first.y));
        return { before: 0, after: 0, line: exactTwips, lineRule: LineRuleType.EXACT };
      })()
    : { before: 0, after: 0, line: Math.max(120, Math.round(item.font.size * 22)) };

  return new Paragraph({
    frame: frameAt(item.x, item.y, frameWidth),
    spacing,
    tabStops: tabStops.length ? tabStops : undefined,
    children,
  });
}

function imageParagraph(item: LayoutImageItem, data: Uint8Array) {
  return new Paragraph({
    frame: frameAt(item.x, item.y),
    spacing: { before: 0, after: 0 },
    children: [new ImageRun({
      type: "png",
      data,
      transformation: {
        width: Math.max(1, Math.round(item.width * POINTS_TO_PIXELS)),
        height: Math.max(1, Math.round(item.height * POINTS_TO_PIXELS)),
      },
    })],
  });
}

function layoutSections(pages: LayoutPage[], assets: Map<string, Uint8Array>) {
  return pages.map((page) => {
    const children: Paragraph[] = [];
    const textItems = page.texts.filter((item) => item.segments.some((segment) => segment.text.trim()));
    for (const group of groupLines(textItems)) {
      children.push(textParagraph(group, page.width));
    }
    for (const item of page.images) {
      const data = assets.get(item.source);
      if (data) children.push(imageParagraph(item, data));
    }
    if (!children.length) children.push(new Paragraph({ children: [] }));
    return {
      properties: {
        page: {
          size: { width: twips(page.width), height: twips(page.height), orientation: page.width > page.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
        },
      },
      children,
    };
  });
}

function textFlowSections(paragraphs: DocxParagraph[]) {
  return [{
    children: paragraphs.map((item) => new Paragraph({
      pageBreakBefore: item.pageBreakBefore,
      spacing: { after: item.heading ? 200 : 160, line: 276 },
      children: item.text ? [new TextRun({ text: item.text, bold: item.heading, size: item.heading ? 26 : 22 })] : [],
    })),
  }];
}

async function loadAsset(image: LayoutImageItem, directory: string, assets: Map<string, Uint8Array>) {
  if (assets.has(image.source)) return;
  try {
    const resolved = path.isAbsolute(image.source) ? image.source : path.join(directory, image.source);
    const bytes = await readFile(resolved);
    if (bytes.length) assets.set(image.source, new Uint8Array(bytes));
  } catch {
    // imagem opcional: segue sem ela
  }
}

async function readPageImages(directory: string, prefix: string, inputPath: string, converter: string) {
  if (!(await commandExists(converter))) return "";
  try {
    await execFile(converter, ["-xml", "-q", "-nodrm", "-enc", "UTF-8", "-zoom", "1", inputPath, prefix], { timeout: 180000, maxBuffer: 96 * 1024 * 1024 });
    return await readFile(`${prefix}.xml`, "utf8");
  } catch {
    return "";
  }
}

/** Abre o DOCX como ZIP, injeta formas VML no document.xml e reempacota. */
async function injectVmlIntoDocx(docx: Uint8Array, vectors: PdfVectorPage[]): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(docx).catch(() => null);
  if (!zip) return docx as Uint8Array<ArrayBuffer>;
  const docEntry = zip.file("word/document.xml");
  if (!docEntry) return docx as Uint8Array<ArrayBuffer>;
  const xml = await docEntry.async("string");
  const patched = injectVectorShapes(xml, vectors);
  if (patched === xml) return docx as Uint8Array<ArrayBuffer>;
  zip.file("word/document.xml", patched);
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Uint8Array(out);
}

export async function pdfToDocx(input: Uint8Array, originalName = "documento") {
  // Motor principal: Microsoft Word (abre o PDF e salva em DOCX preservando o layout nativamente).
  const viaWord = await pdfToDocxWithMsWord(input);
  if (viaWord) return viaWord;
  // Reserva: reconstrução posicional a partir do layout extraído por pdftotext/pdtohtml.
  const extractor = process.env.PDF_TEXT_EXTRACTOR || "pdftotext";
  const htmlConverter = process.env.PDF_HTML_CONVERTER || "pdftohtml";
  if (!(await commandExists(extractor))) throw new Error("O extrator de texto PDF não está configurado neste servidor.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "pdfmaster-docx-"));
  const inputPath = path.join(directory, "input.pdf");
  const layoutPath = path.join(directory, "layout.xml");
  const textPath = path.join(directory, "extracted.txt");
  try {
    await writeFile(inputPath, input);
    let pages: LayoutPage[] = [];
    try {
      await execFile(extractor, ["-bbox-layout", "-enc", "UTF-8", inputPath, layoutPath], { timeout: 180000, maxBuffer: 96 * 1024 * 1024 });
      const xml = await readFile(layoutPath, "utf8");
      const htmlXml = await readPageImages(directory, path.join(directory, "html"), inputPath, htmlConverter);
      pages = parseLayout(xml, htmlXml);
    } catch {
      pages = [];
    }

    const assets = new Map<string, Uint8Array>();
    for (const page of pages) for (const image of page.images) await loadAsset(image, directory, assets);
    const hasText = pages.some((page) => page.texts.some((item) => item.segments.some((segment) => segment.text.trim())));
    if (pages.length && (hasText || assets.size)) {
      // Extrai vetores (linhas/retângulos) do PDF para desenhar bordas e grades.
      const vectors = await extractPdfVectors(input);
      const document = new Document({
        creator: "PDF Master Pro",
        title: originalName,
        description: `Documento recriado a partir de ${originalName} pelo PDF Master Pro.`,
        styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
        sections: layoutSections(pages, assets),
      });
      let buffer = new Uint8Array(await Packer.toBuffer(document));
      // Injeta formas VML (bordas/linhas do PDF) no document.xml para fidelidade visual.
      if (vectors.some((v) => v.lines.length || v.rects.length)) {
        buffer = await injectVmlIntoDocx(buffer, vectors);
      }
      return buffer;
    }

    await execFile(extractor, ["-enc", "UTF-8", inputPath, textPath], { timeout: 180000, maxBuffer: 96 * 1024 * 1024 });
    const paragraphs = buildDocxParagraphs(await readFile(textPath, "utf8"));
    if (!paragraphs.some((item) => item.text.trim())) throw new Error("Este PDF não contém texto extraível. OCR será necessário para documentos digitalizados.");
    const fallback = new Document({
      creator: "PDF Master Pro",
      title: originalName,
      description: `Texto extraído de ${originalName} pelo PDF Master Pro.`,
      styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 160, line: 276 } } } } },
      sections: textFlowSections(paragraphs),
    });
    return new Uint8Array(await Packer.toBuffer(fallback));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
