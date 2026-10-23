import fs from "fs";
import JSZip from "jszip";
const buf = fs.readFileSync(process.env.TEMP + "/opencode/pdf-word-testes/resultados-docx/01_tabela_complexa.docx");
JSZip.loadAsync(buf).then(async z => {
  const xml = (await z.file("word/document.xml").async("nodebuffer")).toString("utf8");
  console.log("p:" + (xml.match(/<w:p[ >]/g)||[]).length);
  console.log("tbl:" + (xml.match(/<w:tbl[ >]/g)||[]).length);
  console.log("framePr:" + (xml.match(/<w:framePr/g)||[]).length);
  console.log("tr:" + (xml.match(/<w:tr/g)||[]).length);
  console.log("tc:" + (xml.match(/<w:tc[ >]/g)||[]).length);
  const start = xml.indexOf("<w:body>");
  console.log(xml.slice(start, start+600));
}).catch(e=>console.log("ERR:"+e.message));
