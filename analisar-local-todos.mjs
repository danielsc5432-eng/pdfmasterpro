import fs from "fs";
import JSZip from "jszip";
const files = ["01_tabela_complexa", "02_duas_colunas", "03_formulario_listas", "04_artigo_cientifico", "05_tabela_larga_landscape"];
for (const f of files) {
  const buf = fs.readFileSync(process.env.TEMP + "/opencode/pdf-word-testes/local-" + f + ".docx");
  const z = await JSZip.loadAsync(buf);
  const xml = (await z.file("word/document.xml").async("nodebuffer")).toString("utf8");
  const p = (xml.match(/<w:p[ >]/g) || []).length;
  const tbl = (xml.match(/<w:tbl[ >]/g) || []).length;
  const tr = (xml.match(/<w:tr[ >]/g) || []).length;
  const tc = (xml.match(/<w:tc[ >]/g) || []).length;
  console.log(f + " => p:" + p + " tbl:" + tbl + " tr:" + tr + " tc:" + tc);
}
