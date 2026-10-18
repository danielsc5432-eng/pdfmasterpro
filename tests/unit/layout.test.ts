import test from "node:test";
import assert from "node:assert/strict";
import { joinLayoutPages, mapFontFamily, parseBboxLayout, parseLayout, parsePdfToHtml, parseSegments } from "../../lib/processing/layout";

const BBOX = `<html><body><doc>
<page width="595.000000" height="842.000000">
<flow locked="0"><block xMin="60.000000" yMin="69.076000" xMax="290.000000" yMax="85.726000">
<line xMin="60.000000" yMin="69.076000" xMax="290.000000" yMax="85.726000">
<word xMin="60.000000" yMin="69.076000" xMax="78.000000" yMax="85.000000">Texto</word>
<word xMin="82.000000" yMin="69.076000" xMax="100.000000" yMax="85.000000">aqui</word>
</line>
</block></flow>
<flow><block xMin="60" yMin="100" xMax="200" yMax="116">
<line xMin="60.000000" yMin="100.000000" xMax="200.000000" yMax="116.000000">
<word xMin="60" yMin="100" xMax="78" yMax="116">Segunda</word>
</line>
</block></flow>
</page>
</doc>`;

const HTML_XML = `<pdf2xml><page number="1">
<fontspec id="0" size="11" family="Helvetica" color="#000000"/>
<fontspec id="1" size="18" family="Arial,Bold" color="#cc0000"/>
<text top="0" left="0" width="10" height="10" font="1"><b>Texto</b> aqui</text>
<text top="0" left="0" width="10" height="10" font="0">Segunda</text>
<image top="63" left="90" width="120" height="60" src="doc-1_1.png"/>
</page></pdf2xml>`;

test("parseBboxLayout extrai páginas, linhas e palavras", () => {
  const pages = parseBboxLayout(BBOX);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].width, 595);
  assert.equal(pages[0].height, 842);
  assert.equal(pages[0].lines.length, 2);
  const line = pages[0].lines[0];
  assert.equal(line.x, 60);
  assert.equal(line.y, 69.076);
  assert.equal(line.text, "Texto aqui");
  assert.ok(Math.abs(line.width - 230) < 0.001);
  assert.ok(Math.abs(line.height - 16.65) < 0.001);
});

test("parsePdfToHtml extrai fontes, negrito e imagens", () => {
  const pages = parsePdfToHtml(HTML_XML);
  assert.equal(Object.keys(pages[0].fonts).length, 2);
  assert.equal(pages[0].fonts["1"].size, 18);
  assert.equal(pages[0].fonts["1"].color, "#CC0000");
  assert.equal(pages[0].texts.length, 2);
  assert.equal(pages[0].texts[0].segments[0].bold, true);
  assert.equal(pages[0].images[0].source, "doc-1_1.png");
  assert.equal(pages[0].images[0].width, 120);
});

test("joinLayoutPages casa o texto com a fonte medida pelo pdftohtml", () => {
  const pages = joinLayoutPages(parseBboxLayout(BBOX), parsePdfToHtml(HTML_XML));
  assert.equal(pages[0].texts.length, 2);
  assert.equal(pages[0].texts[0].font.family, "Arial");
  assert.equal(pages[0].texts[0].font.size, 18);
  assert.equal(pages[0].texts[0].font.color, "#CC0000");
  assert.equal(pages[0].texts[0].segments[0].bold, true);
  assert.equal(pages[0].texts[1].font.size, 11);
  assert.equal(pages[0].texts[1].segments[0].text, "Segunda");
  assert.equal(pages[0].images[0].source, "doc-1_1.png");
});

test("distribui posição e estilo palavra a palavra", () => {
  const pages = joinLayoutPages(parseBboxLayout(BBOX), parsePdfToHtml(HTML_XML));
  const line = pages[0].texts[0];
  assert.equal(line.words.length, 2);
  assert.equal(line.words[0].text, "Texto");
  assert.equal(line.words[0].x, 60);
  assert.equal(line.words[0].bold, true);
  assert.equal(line.words[1].text, "aqui");
  assert.equal(line.words[1].x, 82);
  assert.equal(line.words[1].bold, false);
  assert.equal(line.words[1].italic, false);
});

test("mantém a posição e usa fonte padrão quando não há casamento", () => {
  const pages = joinLayoutPages(parseBboxLayout(BBOX), []);
  assert.equal(pages[0].texts[0].x, 60);
  assert.equal(pages[0].texts[0].y, 69.076);
  assert.equal(pages[0].texts[0].font.family, "Arial");
  assert.equal(pages[0].texts[0].segments[0].text, "Texto aqui");
});

test("parseSegments alterna negrito e itálico", () => {
  assert.deepEqual(parseSegments("<b>Negrito</b> normal <i>italico</i>"), [
    { text: "Negrito", bold: true, italic: false },
    { text: " normal ", bold: false, italic: false },
    { text: "italico", bold: false, italic: true },
  ]);
});

test("mapeia famílias de fonte do PDF para fontes do Word", () => {
  assert.equal(mapFontFamily("ABCDEF+Helvetica"), "Arial");
  assert.equal(mapFontFamily("Arial,Bold"), "Arial");
  assert.equal(mapFontFamily("TimesNewRomanPSMT"), "Times New Roman");
  assert.equal(mapFontFamily("Courier"), "Courier New");
  assert.equal(mapFontFamily("Calibri"), "Calibri");
});

test("reaproveita fontspecs declarados em páginas anteriores", () => {
  const xml = `<pdf2xml><page number="1"><fontspec id="0" size="18" family="Helvetica" color="#000000"/><text top="0" left="0" width="1" height="1" font="0">Titulo</text></page><page number="2"><text top="0" left="0" width="1" height="1" font="0">Titulo</text></page></pdf2xml>`;
  const pages = parsePdfToHtml(xml);
  assert.equal(pages[0].fonts["0"].size, 18);
  assert.equal(pages[1].fonts["0"].size, 18);
  assert.equal(pages[1].texts[0].fontId, "0");
});

test("parseLayout combina as duas extrações", () => {
  const pages = parseLayout(BBOX, HTML_XML);
  assert.equal(pages[0].texts[0].font.size, 18);
  assert.equal(pages[0].images.length, 1);
});
