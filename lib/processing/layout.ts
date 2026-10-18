export type LayoutSegment = { text: string; bold: boolean; italic: boolean };

export type LayoutFont = { family: string; size: number; color: string; bold: boolean; italic: boolean };

export type LayoutWord = { text: string; x: number; width: number; bold: boolean; italic: boolean };

export type LayoutTextItem = {
  x: number;
  y: number;
  width: number;
  height: number;
  segments: LayoutSegment[];
  words: LayoutWord[];
  font: LayoutFont;
};

export type LayoutImageItem = { x: number; y: number; width: number; height: number; source: string };

export type LayoutPage = { width: number; height: number; texts: LayoutTextItem[]; images: LayoutImageItem[] };

type BboxWord = { text: string; x: number; width: number };

type BboxLine = { x: number; y: number; width: number; height: number; text: string; words: BboxWord[] };

type BboxPage = { width: number; height: number; lines: BboxLine[] };

type HtmlRun = { fontId: string; left: number; segments: LayoutSegment[]; plain: string };

type HtmlPage = { fonts: Record<string, LayoutFont>; texts: HtmlRun[]; images: LayoutImageItem[] };

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const BASE_FONT_MAP: [RegExp, string][] = [
  [/^helvetica/i, "Arial"],
  [/^arial/i, "Arial"],
  [/^liberation sans/i, "Arial"],
  [/^dejavu sans/i, "Arial"],
  [/^times/i, "Times New Roman"],
  [/^liberation serif/i, "Times New Roman"],
  [/^dejavu serif/i, "Times New Roman"],
  [/^courier/i, "Courier New"],
  [/^liberation mono/i, "Courier New"],
  [/^dejavu sans mono/i, "Courier New"],
  [/^nimbus sans/i, "Arial"],
  [/^nimbus roman/i, "Times New Roman"],
  [/^nimbus mono/i, "Courier New"],
];

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return XML_ENTITIES[entity] ?? match;
  });
}

function parseAttributes(raw: string) {
  const attributes: Record<string, string> = {};
  for (const match of raw.matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*"([^"]*)"/g)) attributes[match[1]] = decodeEntities(match[2]);
  return attributes;
}

function toNumber(value: string | undefined, fallback = 0) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "");
}

export function mapFontFamily(family: string) {
  const base = family
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/(,|\s|-|_)?(Bold|Italic|Oblique|BoldItalic|Regular|Normal|MT|PSMT)$/i, "")
    .trim();
  if (!base) return "Arial";
  for (const [pattern, target] of BASE_FONT_MAP) if (pattern.test(base)) return target;
  return base;
}

function normalizeColor(color: string) {
  const value = color.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toUpperCase()}` : color || "#000000";
}

export function parseSegments(content: string): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  let bold = false;
  let italic = false;
  let cursor = 0;
  const push = (raw: string) => {
    const text = decodeEntities(raw);
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.bold === bold && last.italic === italic) last.text += text;
    else segments.push({ text, bold, italic });
  };
  for (const match of content.matchAll(/<\/?([a-zA-Z][\w:-]*)(?:\s[^>]*)?\/?>/g)) {
    push(content.slice(cursor, match.index));
    cursor = (match.index ?? 0) + match[0].length;
    if (match[0].endsWith("/>")) continue;
    const name = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    if (name === "b" || name === "strong") bold = !closing;
    else if (name === "i" || name === "em") italic = !closing;
  }
  push(content.slice(cursor));
  return segments;
}

export function parseBboxLayout(xml: string): BboxPage[] {
  const pages: BboxPage[] = [];
  for (const page of xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    const attributes = parseAttributes(page[1]);
    const lines: BboxLine[] = [];
    for (const line of page[2].matchAll(/<line\b([^>]*)>([\s\S]*?)<\/line>/g)) {
      const lineAttributes = parseAttributes(line[1]);
      const words = [...line[2].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)]
        .map((word) => {
          const wordAttributes = parseAttributes(word[1]);
          const x = toNumber(wordAttributes.xMin);
          return { text: decodeEntities(word[2]).trim(), x, width: Math.max(0, toNumber(wordAttributes.xMax) - x) };
        })
        .filter((word) => word.text);
      const text = words.map((word) => word.text).join(" ").trim();
      if (!text) continue;
      const x = toNumber(lineAttributes.xMin);
      const y = toNumber(lineAttributes.yMin);
      lines.push({ x, y, width: Math.max(0, toNumber(lineAttributes.xMax) - x), height: Math.max(0, toNumber(lineAttributes.yMax) - y), text, words });
    }
    pages.push({ width: toNumber(attributes.width, 595), height: toNumber(attributes.height, 842), lines });
  }
  return pages;
}

export function parsePdfToHtml(xml: string): HtmlPage[] {
  const pages: HtmlPage[] = [];
  const sharedFonts: Record<string, LayoutFont> = {};
  for (const page of xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    for (const spec of page[2].matchAll(/<fontspec\b([^>]*?)\/?>/g)) {
      const attributes = parseAttributes(spec[1]);
      if (!attributes.id) continue;
      sharedFonts[attributes.id] = { family: attributes.family || "Arial", size: toNumber(attributes.size, 0), color: normalizeColor(attributes.color), bold: false, italic: false };
    }
    const fonts: Record<string, LayoutFont> = { ...sharedFonts };
    const texts: HtmlRun[] = [];
    for (const text of page[2].matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const attributes = parseAttributes(text[1]);
      const segments = parseSegments(text[2]);
      const plain = segments.map((segment) => segment.text).join("");
      if (plain.trim()) texts.push({ fontId: attributes.font || "", left: toNumber(attributes.left), segments, plain });
    }
    const images: LayoutImageItem[] = [];
    for (const image of page[2].matchAll(/<image\b([^>]*?)\/?>/g)) {
      const attributes = parseAttributes(image[1]);
      if (!attributes.src) continue;
      images.push({ x: toNumber(attributes.left), y: toNumber(attributes.top), width: toNumber(attributes.width), height: toNumber(attributes.height), source: attributes.src });
    }
    pages.push({ fonts, texts, images });
  }
  return pages;
}

function findRun(runs: HtmlRun[], cursor: number, target: string, lineX: number, tolerance: number) {
  const normalized = normalizeText(target);
  for (let index = cursor; index < Math.min(runs.length, cursor + 12); index++) {
    const run = runs[index];
    if (normalizeText(run.plain) === normalized) {
      const distance = run.left >= 0 && lineX >= 0 ? Math.abs(run.left - lineX) : 0;
      if (distance > tolerance) continue;
      return { run, nextCursor: index + 1 };
    }
  }
  for (let index = cursor; index < Math.min(runs.length, cursor + 12); index++) {
    const run = runs[index];
    const combined = normalizeText(run.plain);
    if (combined === normalized) return { run, nextCursor: index + 1 };
  }
  for (let end = cursor + 1; end <= Math.min(runs.length, cursor + 6); end++) {
    const slice = runs.slice(cursor, end);
    const combined = slice.map((run) => normalizeText(run.plain)).join("");
    if (combined === normalized) {
      const segments = slice.flatMap((run) => run.segments);
      return {
        run: { fontId: runs[cursor].fontId, left: runs[cursor].left, segments, plain: slice.map((run) => run.plain).join("") },
        nextCursor: end,
      };
    }
    if (combined.length > normalized.length) break;
  }
  return null;
}

function styleWords(words: BboxLine["words"], segments: LayoutSegment[], font: LayoutFont): LayoutWord[] {
  const flat = segments
    .flatMap((segment) => [...segment.text].map((character) => ({ character, bold: segment.bold, italic: segment.italic })))
    .filter((entry) => !/\s/.test(entry.character));
  const expected = words.reduce((total, word) => total + word.text.length, 0);
  const aligned = flat.length === expected;
  let pointer = 0;
  return words.map((word) => {
    const slice = aligned ? flat.slice(pointer, pointer + word.text.length) : [];
    pointer += word.text.length;
    return {
      text: word.text,
      x: word.x,
      width: word.width,
      bold: aligned ? slice.some((entry) => entry.bold) : font.bold,
      italic: aligned ? slice.some((entry) => entry.italic) : font.italic,
    };
  });
}

export function joinLayoutPages(bboxPages: BboxPage[], htmlPages: HtmlPage[]): LayoutPage[] {
  return bboxPages.map((page, index) => {
    const html = htmlPages[index];
    const runs = html?.texts ?? [];
    const fonts = html?.fonts ?? {};
    let cursor = 0;
    const texts: LayoutTextItem[] = page.lines.map((line) => {
      const target = normalizeText(line.text);
      const match = findRun(runs, cursor, target, line.x, 10);
      const spec = match ? fonts[match.run.fontId] : undefined;
      if (match) cursor = match.nextCursor;
      const size = spec && spec.size > 0 ? spec.size : Math.max(6, line.height || 11);
      const font: LayoutFont = {
        family: mapFontFamily(spec?.family ?? "Arial"),
        size,
        color: spec?.color ?? "#000000",
        bold: false,
        italic: false,
      };
      const segments = match ? match.run.segments : [{ text: line.text, bold: false, italic: false }];
      return { x: line.x, y: line.y, width: line.width, height: line.height, segments, words: styleWords(line.words, segments, font), font };
    });

    const merged: LayoutTextItem[] = [];
    for (const item of texts) {
      const existing = merged.find((candidate) => Math.abs(candidate.y - item.y) < 0.8);
      if (existing) {
        existing.words = [...existing.words, ...item.words].sort((a, b) => a.x - b.x);
        const combinedText = existing.words.map((word) => word.text).join(" ");
        existing.segments = [{ text: combinedText, bold: existing.font.bold, italic: existing.font.italic }];
        existing.x = Math.min(existing.x, item.x);
        existing.width = Math.max(existing.width + existing.x, item.width + item.x) - existing.x;
        continue;
      }
      merged.push({ ...item, words: [...item.words].sort((a, b) => a.x - b.x) });
    }
    return { width: page.width, height: page.height, texts: merged, images: html?.images ?? [] };
  });
}

export function parseLayout(bboxXml: string, htmlXml: string): LayoutPage[] {
  const bboxPages = parseBboxLayout(bboxXml);
  const htmlPages = htmlXml ? parsePdfToHtml(htmlXml) : [];
  return joinLayoutPages(bboxPages, htmlPages);
}
