import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { Document, FrameAnchorType, FrameWrap, ImageRun, PageOrientation, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { parseLayout, type LayoutImageItem, type LayoutPage, type LayoutTextItem } from "./layout";
import { fitDocxToPdfPage, pdfToDocxWithMsWord } from "./msword";
import { commandExists, execFile } from "./system";

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

function frameAt(x: number, y: number) {
  return {
    type: "absolute" as const,
    position: { x: twips(x), y: twips(y) },
    anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    wrap: FrameWrap.NONE,
  };
}

function textParagraph(item: LayoutTextItem) {
  const color = item.font.color.replace("#", "").toUpperCase();
  const size = Math.max(2, Math.round(item.font.size * 2));
  const regular = /^[0-9A-F]{6}$/.test(color) ? color : "000000";
  const threshold = item.font.size * 0.45;
  const hasWideGap = item.words.some((word, index) => {
    if (!index) return false;
    const previous = item.words[index - 1];
    return word.x - (previous.x + previous.width) > threshold && word.x - item.words[0].x > 0;
  });
  const positioned = item.words.length > 1 && hasWideGap;

  const run = (text: string, bold: boolean, italic: boolean) => new TextRun({
    text,
    font: item.font.family,
    size,
    bold: bold || item.font.bold,
    italics: italic || item.font.italic,
    color: regular,
  });

  const tabStops: { type: (typeof TabStopType)[keyof typeof TabStopType]; position: number }[] = [];
  const children: TextRun[] = [];

  if (positioned) {
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

  return new Paragraph({
    frame: frameAt(item.x, item.y),
    spacing: { before: 0, after: 0, line: Math.max(120, Math.round(item.font.size * 22)) },
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
    for (const item of page.texts) {
      if (!item.segments.some((segment) => segment.text.trim())) continue;
      children.push(textParagraph(item));
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

/**
 * Converte PDF em DOCX usando o LibreOffice (abre o PDF via Draw e exporta para Writer DOCX).
 * Devolve null quando indisponível ou quando a conversão produz um arquivo sem conteúdo.
 */
async function pdfToDocxWithLibreOffice(input: Uint8Array): Promise<Uint8Array | null> {
  const converter = process.env.SOFFICE_CONVERTER || "soffice";
  if (!(await commandExists(converter))) return null;
  const directory = await mkdtemp(path.join(os.tmpdir(), "pdfmaster-lo-"));
  try {
    const inputPath = path.join(directory, "input.pdf");
    const outputPath = path.join(directory, "input.docx");
    const profile = path.join(directory, "profile");
    await writeFile(inputPath, input);
    await execFile(
      converter,
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        "--headless",
        "--convert-to", "docx",
        "--outdir", directory,
        inputPath,
      ],
      { timeout: 180000, maxBuffer: 96 * 1024 * 1024 },
    );
    const bytes = await readFile(outputPath);
    if (bytes.length < 200) return null;
    const output = new Uint8Array(bytes);
    // Valida que o DOCX contém texto real (protege contra conversões Draw vazias).
    const zip = await JSZip.loadAsync(output).catch(() => null);
    const documentXml = zip?.file("word/document.xml");
    if (!documentXml) return null;
    const xml = await documentXml.async("string");
    if (!/<w:t[^>]*>[^<]+<\/w:t>/.test(xml)) return null;
    // Corrige tamanhos de página para casar com o PDF original (LibreOffice pode normalizar para A4/Letter).
    return await fitDocxToPdfPage(output, input);
  } catch {
    return null;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function pdfToDocx(input: Uint8Array, originalName = "documento") {
  // Motor principal: Microsoft Word (abre o PDF e salva em DOCX preservando o layout nativamente).
  const viaWord = await pdfToDocxWithMsWord(input);
  if (viaWord) return viaWord;
  // Segundo motor: LibreOffice (parser PDF nativo via Draw, exporta para Writer DOCX).
  const viaLibreOffice = await pdfToDocxWithLibreOffice(input);
  if (viaLibreOffice) return viaLibreOffice;
  // Reserva: reconstrução manual a partir do layout extraído por pdftotext/pdtohtml.
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
      const document = new Document({
        creator: "PDF Master Pro",
        title: originalName,
        description: `Documento recriado a partir de ${originalName} pelo PDF Master Pro.`,
        styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
        sections: layoutSections(pages, assets),
      });
      return new Uint8Array(await Packer.toBuffer(document));
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
