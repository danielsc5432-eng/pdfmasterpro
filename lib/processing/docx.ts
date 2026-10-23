import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { AlignmentType, BorderStyle, Document, FrameAnchorType, FrameWrap, ImageRun, LineRuleType, PageOrientation, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType } from "docx";
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



function textParagraph(items: LayoutTextItem[], pageWidth: number) {
  const item = items[0];
  const color = item.font.color.replace("#", "").toUpperCase();
  const size = Math.max(2, Math.round(item.font.size * 2));
  const regular = /^[0-9A-F]{6}$/.test(color) ? color : "000000";
  // Posiciona palavra a palavra com tabulações sempre que houver múltiplas
  // palavras: garante o alinhamento horizontal exato do PDF (sem drift).
  const positioned = item.words.length > 1 && items.length === 1;

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
        // Tabulação até a posição horizontal exata da palavra no PDF.
        const target = word.x - item.words[0].x;
        if (target > 0.5) {
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
  // Espaçamento entre linhas real do PDF (multi-linha) ou linha única com
  // altura exata de 1,2× o corpo. A altura exata torna previsível onde o Word
  // coloca a linha de base (ver `baselineShift` abaixo).
  const spacing = items.length > 1
    ? (() => {
        const first = items[0];
        const second = items[1];
        const exactTwips = Math.max(40, twips(second.y - first.y));
        return { before: 0, after: 0, line: exactTwips, lineRule: LineRuleType.EXACT };
      })()
    : { before: 0, after: 0, line: Math.max(40, Math.round(item.font.size * 1.2 * 20)), lineRule: LineRuleType.EXACT };

  // O topo do quadro é o topo da caixa de linha; o Word desenha o texto com a
  // linha de base a ~1,2·corpo do topo (para a altura exata acima). Recuamos o
  // quadro em 0,24·corpo para que a linha de base coincida exatamente com a do
  // PDF — sem isso o texto fica alguns pontos abaixo (e o desvio variava com o
  // corpo da fonte, quebrando o alinhamento).
  const baselineShift = item.font.size * 0.24;

  return new Paragraph({
    frame: frameAt(item.x, item.y - baselineShift, frameWidth),
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

function itemText(item: LayoutTextItem) {
  return item.segments.map((segment) => segment.text).join("").replace(/\s+/g, " ").trim();
}

function hexColor(value: string | undefined, fallback = "000000") {
  const hex = String(value ?? "").replace("#", "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(hex) ? hex : fallback;
}

function itemRuns(item: LayoutTextItem, bold = false): TextRun[] {
  const font = item.font;
  const size = Math.max(2, Math.round((font.size || 10) * 2));
  const color = hexColor(font.color);
  const segments = item.segments.filter((segment) => segment.text);
  if (!segments.length) {
    const text = itemText(item);
    return text ? [new TextRun({ text, font: font.family || "Arial", size, bold: bold || font.bold, italics: font.italic, color })] : [];
  }
  return segments.map((segment) => new TextRun({
    text: segment.text,
    font: font.family || "Arial",
    size,
    bold: bold || segment.bold || font.bold,
    italics: segment.italic || font.italic,
    color,
  }));
}

type LayoutRow = { top: number; bottom: number; items: LayoutTextItem[] };

/** Agrupa itens de texto em linhas usando sobreposição vertical (robusto a diferenças de fonte). */
function groupLayoutRows(items: LayoutTextItem[]): LayoutRow[] {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const rows: LayoutRow[] = [];
  for (const item of sorted) {
    const height = Math.max(2, item.height || item.font.size || 10);
    const top = item.y;
    const bottom = item.y + height;
    const match = rows.find((row) => {
      const overlap = Math.min(bottom, row.bottom) - Math.max(top, row.top);
      const smallest = Math.min(height, row.bottom - row.top);
      return overlap > smallest * 0.4;
    });
    if (match) {
      match.items.push(item);
      match.top = Math.min(match.top, top);
      match.bottom = Math.max(match.bottom, bottom);
    } else {
      rows.push({ top, bottom, items: [item] });
    }
  }
  rows.sort((a, b) => a.top - b.top);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows.filter((row) => row.items.some((item) => itemText(item).length > 0));
}

/** Agrupa posições X em colunas (tolerância proporcional ao corpo do texto). */
function columnClusters(rows: LayoutRow[]): number[] {
  const xs = rows.flatMap((row) => row.items.map((item) => item.x)).sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last === undefined || x - last > 18) clusters.push(x);
  }
  return clusters;
}

/** Uma linha é tabular quando tem 2+ células curtas e separadas horizontalmente. */
function rowIsTabular(row: LayoutRow) {
  const cells = row.items
    .map((item) => ({ item, text: itemText(item) }))
    .filter((entry) => entry.text.length > 0 && /[0-9A-Za-zÀ-ÿ]/.test(entry.text.replace(/_{2,}/g, "")));
  if (cells.length < 2) return false;
  if (cells.some((entry) => entry.text.length > 90)) return false;
  const compact = cells.some((entry) => entry.text.replace(/\s+/g, "").length <= 16);
  const numeric = cells.some((entry) => /[0-9]/.test(entry.text));
  if (!compact && !numeric) return false;
  return cells[cells.length - 1].item.x - cells[0].item.x > 40;
}

/** Detecta regiões de prosa em 2 a 4 colunas (jornais, artigos, relatórios). */
function detectProseColumns(items: LayoutTextItem[], pageWidth: number): LayoutTextItem[][] | null {
  const prose = (item: LayoutTextItem) => itemText(item).length > 22 || item.width > pageWidth * 0.12;
  const proseItems = items.filter(prose);
  if (proseItems.length < 5) return null;
  const bands: number[] = [];
  for (const x of proseItems.map((item) => item.x).sort((a, b) => a - b)) {
    const last = bands[bands.length - 1];
    if (last === undefined || x - last > pageWidth * 0.04) bands.push(x);
  }
  if (bands.length < 2 || bands.length > 4) return null;
  for (let index = 1; index < bands.length; index += 1) {
    if (bands[index] - bands[index - 1] < pageWidth * 0.12) return null;
  }
  const groups: LayoutTextItem[][] = bands.map(() => []);
  for (const item of items) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    bands.forEach((x, index) => {
      const distance = Math.abs(item.x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    groups[bestIndex].push(item);
  }
  if (groups.some((group) => group.filter(prose).length < 3)) return null;
  return groups.map((group) => group.sort((a, b) => a.y - b.y || a.x - b.x));
}

/** Blocos consecutivos de linhas tabulares que formam tabelas válidas. */
function findTableBlocks(rows: LayoutRow[]) {
  const blocks: { start: number; end: number }[] = [];
  let index = 0;
  while (index < rows.length) {
    if (rowIsTabular(rows[index])) {
      let end = index;
      while (end < rows.length && rowIsTabular(rows[end])) end += 1;
      const columns = columnClusters(rows.slice(index, end));
      if (end - index >= 3 && columns.length >= 2 && columns.length <= 16) {
        // Evita transformar prosa (jornais, artigos) em tabela: tabelas reais
        // têm células curtas ou com números na maior parte das linhas.
        const cells = rows.slice(index, end).flatMap((row) => row.items).map(itemText);
        const compactCells = cells.filter((text) => text.replace(/\s+/g, "").length <= 16).length;
        const numericCells = cells.filter((text) => /[0-9]/.test(text)).length;
        if (compactCells >= cells.length * 0.35 || numericCells >= cells.length * 0.35) blocks.push({ start: index, end });
      }
      index = end;
    } else {
      index += 1;
    }
  }
  return blocks;
}

/** Junta itens da mesma linha em um único parágrafo, preservando formatação. */
function rowParagraph(row: LayoutRow): Paragraph {
  const children: TextRun[] = [];
  row.items.forEach((item, index) => {
    const text = itemText(item);
    if (!text) return;
    if (children.length) children.push(new TextRun({ text: index > 0 ? "  " : " ", font: item.font.family || "Arial", size: Math.max(2, Math.round((item.font.size || 10) * 2)) }));
    children.push(...itemRuns(item));
  });
  const first = row.items[0];
  return new Paragraph({
    spacing: { before: 20, after: 20, line: Math.max(200, Math.round((first?.font.size || 10) * 1.35 * 20)) },
    children: children.length ? children : [new TextRun({ text: "" })],
  });
}

/** Junta várias linhas de uma coluna em parágrafos contínuos (reflow no Word). */
function mergedParagraphs(items: LayoutTextItem[]): Paragraph[] {
  const output: Paragraph[] = [];
  let buffer: LayoutTextItem[] = [];
  const sizes = items.map((item) => item.font.size || 10).sort((a, b) => a - b);
  const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
  const flush = () => {
    if (!buffer.length) return;
    const children: TextRun[] = [];
    for (const item of buffer) {
      if (children.length) children.push(new TextRun({ text: " " }));
      children.push(...itemRuns(item));
    }
    output.push(new Paragraph({ spacing: { before: 30, after: 30 }, children }));
    buffer = [];
  };
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const currentText = itemText(item);
    const isListItem = /^([-*•·◦▪]|\(?[0-9]{1,3}(?:\.[0-9]{1,3})*[.)]|[a-z][.)])\s+/i.test(currentText);
    if (isListItem) {
      flush();
      buffer.push(item);
      flush();
      continue;
    }
    const previous = buffer[buffer.length - 1];
    if (previous) {
      const sizeChange = Math.abs((previous.font.size || 10) - (item.font.size || 10)) > 1.5;
      const smallPrint = (previous.font.size || 10) < medianSize * 0.8;
      const previousText = itemText(previous);
      const continues = !/[.!?…:;]$/.test(previousText) && !/[_]{3,}/.test(previousText) && (/^[a-zà-öø-ÿ(«"“']/u.test(currentText) || /[,\-–—/]$/.test(previousText));
      if (sizeChange || smallPrint || !continues) flush();
    }
    buffer.push(item);
  }
  flush();
  return output;
}

/** Converte um bloco de linhas tabulares em uma tabela real do Word. */
function buildTable(block: LayoutRow[]): Table {
  const clusters = columnClusters(block);
  const rows = block.map((row, rowIndex) => {
    const buckets: LayoutTextItem[][] = clusters.map(() => []);
    for (const item of row.items) {
      if (!itemText(item)) continue;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      clusters.forEach((x, index) => {
        const distance = Math.abs(item.x - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      buckets[bestIndex].push(item);
    }
    const header = rowIndex === 0;
    const cells = buckets.map((items) => {
      const sorted = [...items].sort((a, b) => a.x - b.x);
      const children: TextRun[] = [];
      sorted.forEach((item) => {
        if (children.length) children.push(new TextRun({ text: " " }));
        children.push(...itemRuns(item, header));
      });
      return new TableCell({
        shading: header ? { type: ShadingType.CLEAR, fill: "F2F3F7", color: "auto" } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: children.length ? children : [new TextRun({ text: "" })] })],
      });
    });
    return new TableRow({ children: cells, tableHeader: header });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D6D6DE" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D6D6DE" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D6D6DE" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D6D6DE" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E3E3EA" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E3E3EA" },
    },
  });
}

function layoutSections(pages: LayoutPage[], assets: Map<string, Uint8Array>) {
  return pages.map((page) => {
    const children: (Paragraph | Table)[] = [];
    const textItems = page.texts.filter((item) => itemText(item).length > 0);
    if (!textItems.length && !page.images.length) {
      children.push(new Paragraph({ children: [] }));
      return {
        properties: {
          page: {
            size: { width: twips(page.width), height: twips(page.height), orientation: page.width > page.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      };
    }

    const rows = groupLayoutRows(textItems);
    const blocks = findTableBlocks(rows);
    const blockItems = new Set(blocks.flatMap((block) => rows.slice(block.start, block.end).flatMap((row) => row.items)));
    const freeItems = textItems.filter((item) => !blockItems.has(item));
    const proseColumns = detectProseColumns(freeItems, page.width);

    if (proseColumns) {
      // Separa cada coluna em blocos verticais (título, corpo, legendas/rodapé)
      // para preservar a ordem de leitura correta da página.
      type Segment = { items: LayoutTextItem[]; top: number; bottom: number };
      const segments: Segment[] = [];
      for (const column of proseColumns) {
        const heights = column.map((item) => item.height || item.font.size || 10).sort((a, b) => a - b);
        const lineHeight = heights[Math.floor(heights.length / 2)] || 10;
        let current: Segment | null = null;
        for (const item of column) {
          const top = item.y;
          const bottom = item.y + (item.height || item.font.size || 10);
          if (current && top - current.bottom > lineHeight * 1.8) {
            segments.push(current);
            current = null;
          }
          if (current) {
            current.items.push(item);
            current.bottom = Math.max(current.bottom, bottom);
          } else {
            current = { items: [item], top, bottom };
          }
        }
        if (current) segments.push(current);
      }
      const mainByColumn = proseColumns.map(() => -1);
      segments.forEach((segment, segmentIndex) => {
        const columnIndex = proseColumns.findIndex((column) => column.includes(segment.items[0]));
        if (columnIndex >= 0 && (mainByColumn[columnIndex] < 0 || segment.items.length > segments[mainByColumn[columnIndex]].items.length)) {
          mainByColumn[columnIndex] = segmentIndex;
        }
      });
      const mains = mainByColumn.filter((index) => index >= 0).map((index) => segments[index]);
      const extras = segments.filter((_, index) => !mainByColumn.includes(index));
      if (mains.length) {
        const mainTop = Math.min(...mains.map((segment) => segment.top));
        const mainBottom = Math.max(...mains.map((segment) => segment.bottom));
        for (const segment of extras.filter((entry) => entry.bottom <= mainTop).sort((a, b) => a.top - b.top)) {
          children.push(...mergedParagraphs(segment.items));
        }
        for (const segment of mains) children.push(...mergedParagraphs(segment.items));
        for (const segment of extras.filter((entry) => entry.top >= mainBottom).sort((a, b) => a.top - b.top)) {
          children.push(...mergedParagraphs(segment.items));
        }
        for (const segment of extras.filter((entry) => entry.bottom > mainTop && entry.top < mainBottom).sort((a, b) => a.top - b.top)) {
          children.push(...mergedParagraphs(segment.items));
        }
      } else {
        for (const column of proseColumns) children.push(...mergedParagraphs(column));
      }
      for (const block of blocks) children.push(buildTable(rows.slice(block.start, block.end)));
    } else {
      let buffer: LayoutTextItem[] = [];
      const flushBuffer = () => {
        if (!buffer.length) return;
        children.push(...mergedParagraphs(buffer));
        buffer = [];
      };
      let index = 0;
      while (index < rows.length) {
        const block = blocks.find((entry) => entry.start === index);
        if (block) {
          flushBuffer();
          children.push(buildTable(rows.slice(block.start, block.end)));
          index = block.end;
          continue;
        }
        const row = rows[index];
        if (row.items.length === 1) {
          buffer.push(row.items[0]);
        } else {
          flushBuffer();
          children.push(rowParagraph(row));
        }
        index += 1;
      }
      flushBuffer();
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
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
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

/** Número de páginas via pdfinfo (0 quando indisponível). */
async function pdfPageCount(inputPath: string) {
  try {
    const { stdout } = await execFile("pdfinfo", [inputPath], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const match = /^Pages:\s+(\d+)/m.exec(stdout);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

/** Verifica rapidamente se o PDF tem imagens raster antes de renderizar páginas. */async function pdfHasRasterImages(inputPath: string) {
  try {
    const { stdout } = await execFile("pdfimages", ["-list", inputPath], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    return stdout.split(/\r?\n/).some((line) => /^\s*\d+\s+\d+\s+image\b/.test(line));
  } catch {
    return true; // sem pdfimages: mantém o comportamento anterior
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
  const viaWord = process.env.PDF_TO_WORD_DISABLE_MSWORD === "1" ? null : await pdfToDocxWithMsWord(input);
  if (viaWord) return viaWord;
  // Reserva 2: LibreOffice / soffice (desativado temporariamente para testar renderizador posicional melhorado)
  if (process.env.PDF_TO_WORD_USE_LIBREOFFICE === "1") {
    const configured = process.env.PDF_TO_WORD_CONVERTER;
    let converter = !configured || configured.toLowerCase() === "msword" ? (process.env.SOFFICE_CONVERTER || "soffice") : configured;
    if (!(await commandExists(converter))) {
      for (const c of ["soffice", "libreoffice", "/usr/bin/soffice", "/usr/bin/libreoffice", "/snap/bin/libreoffice"]) {
        if (await commandExists(c)) { converter = c; break; }
      }
    }
    if (await commandExists(converter)) {
      const directory = await mkdtemp(path.join(os.tmpdir(), "pdfmaster-libre-docx-"));
      const inputPath = path.join(directory, "input.pdf");
      const profile = path.join(directory, "profile");
      try {
        await writeFile(inputPath, input);
        await execFile(converter, [`-env:UserInstallation=${pathToFileURL(profile).href}`, "--headless", "--infilter=writer_pdf_import", "--convert-to", "docx:MS Word 2007 XML", "--outdir", directory, inputPath], { timeout: 300000 });
        const entries = await readdir(directory);
        const docxEntry = entries.find((name) => name.toLowerCase().endsWith(".docx"));
        if (docxEntry) {
          const bytes = await readFile(path.join(directory, docxEntry));
          if (bytes.length > 1000) return new Uint8Array(bytes);
        }
        const docxEntry2 = entries.find((name) => name.toLowerCase().endsWith(".docx") && name !== "input.docx");
        if (docxEntry2) {
          const bytes = await readFile(path.join(directory, docxEntry2));
          if (bytes.length > 1000) return new Uint8Array(bytes);
        }
      } catch { /* cai para o renderizador posicional */ }
      finally { await rm(directory, { recursive: true, force: true }).catch(() => undefined); }
    }
  }
  // Reserva 3: reconstrução posicional a partir do layout extraído por pdftotext/pdtohtml.
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
      const pageCount = await pdfPageCount(inputPath);
      const maxImagePages = Number(process.env.PDF_TO_WORD_MAX_IMAGE_PAGES || 90);
      const renderImages = pageCount === 0 || pageCount <= maxImagePages;
      // pdftotext e a extração de imagens são independentes: rodam em paralelo.
      const [xml, htmlXml] = await Promise.all([
        (async () => {
          await execFile(extractor, ["-bbox-layout", "-enc", "UTF-8", inputPath, layoutPath], { timeout: 180000, maxBuffer: 96 * 1024 * 1024 });
          return readFile(layoutPath, "utf8");
        })(),
        (async () => {
          if (!renderImages) return "";
          // Só renderiza as páginas com pdftohtml quando existem imagens raster:
          // em documentos só de texto isso economiza tempo e memória.
          if (!(await pdfHasRasterImages(inputPath))) return "";
          return readPageImages(directory, path.join(directory, "html"), inputPath, htmlConverter);
        })(),
      ]);
      pages = parseLayout(xml, htmlXml);
    } catch {
      pages = [];
    }

    const assets = new Map<string, Uint8Array>();
    for (const page of pages) for (const image of page.images) await loadAsset(image, directory, assets);
    const hasText = pages.some((page) => page.texts.some((item) => item.segments.some((segment) => segment.text.trim())));
    if (pages.length && (hasText || assets.size)) {
      // Extrai vetores (linhas/retângulos) do PDF para desenhar bordas e grades.
      // Em documentos muito grandes pulamos essa etapa (cara em CPU) para não
      // estourar o tempo limite do servidor: as tabelas já têm bordas próprias.
      const maxVectorPages = Number(process.env.PDF_TO_WORD_MAX_VECTOR_PAGES || 40);
      const vectors = pages.length <= maxVectorPages ? await extractPdfVectors(input) : [];
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
