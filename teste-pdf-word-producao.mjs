import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const Q = path.join(process.env.TEMP, "opencode", "pdf-word-testes");
const WORKER = process.env.WORKER || "https://pdfmasterpro.onrender.com";
const OUT = path.join(Q, "resultados-docx");
await mkdir(OUT, { recursive: true });

const arquivos = [
  "01_tabela_complexa.pdf",
  "02_duas_colunas.pdf", 
  "03_formulario_listas.pdf",
  "04_artigo_cientifico.pdf",
  "05_tabela_larga_landscape.pdf",
];

function nota(texto) {
  let n = 0;
  const checks = [
    [/tabela|table/i, 2],
    [/\d{1,3}\.\d{3}/, 1], // números com milhar
    [/R\$/, 1],
    [/[A-Z][a-z]+ [A-Z]/, 1],
    [/Página|página/i, 1],
    [/l[íi]quido|receita|lucro/i, 1],
    [/INTELIGÊNCIA|inteligência/i, 1],
    [/CNPJ|Razão Social/i, 1],
    [/Resumo|Introdução/i, 1],
    [/PETR4|VALE3/i, 1],
  ];
  for (const [re, p] of checks) if (re.test(texto)) n += p;
  return Math.min(10, n);
}

console.log("=".repeat(80));
console.log("TESTE PDF -> WORD NA PRODUÇÃO");
console.log(`Worker: ${WORKER}`);
console.log("=".repeat(80));

for (const arq of arquivos) {
  console.log(`\n📄 ${arq}`);
  try {
    const buf = await readFile(path.join(Q, arq));
    const form = new FormData();
    form.append("files", new Blob([buf], { type: "application/pdf" }), arq);
    
    const t0 = Date.now();
    const res = await fetch(`${WORKER}/api/v1/process?tool=pdf-para-word`, { method: "POST", body: form });
    const ms = Date.now() - t0;
    
    if (!res.ok) {
      const err = await res.text();
      console.log(`   ❌ HTTP ${res.status} em ${(ms/1000).toFixed(1)}s`);
      console.log(`   ${err.slice(0, 150)}`);
      continue;
    }
    
    const outBuf = Buffer.from(await res.arrayBuffer());
    if (outBuf[0] !== 0x50 || outBuf[1] !== 0x4b) {
      console.log(`   ❌ Não é DOCX válido`);
      continue;
    }
    
    const zip = await JSZip.loadAsync(outBuf);
    const docXml = zip.file("word/document.xml");
    if (!docXml) {
      console.log(`   ❌ sem word/document.xml`);
      continue;
    }
    
    const xml = (await docXml.async("nodebuffer")).toString("utf8");
    const txts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join(" ");
    const paragrafos = (xml.match(/<w:p\b/g) || []).length;
    const tabelas = (xml.match(/<w:tbl\b/g) || []).length;
    const tabelasLinhas = (xml.match(/<w:tr\b/g) || []).length;
    
    const n = nota(txts);
    await writeFile(path.join(OUT, arq.replace(".pdf", ".docx")), outBuf);
    
    console.log(`   ✅ DOCX gerado em ${(ms/1000).toFixed(1)}s | ${outBuf.length} bytes`);
    console.log(`   📊 Parágrafos: ${paragrafos} | Tabelas: ${tabelas} | Linhas de tabela: ${tabelasLinhas}`);
    console.log(`   📝 Texto extraído: ${txts.length} chars`);
    console.log(`   🎯 Qualidade estimada: ${n}/10`);
    console.log(`   🔍 Preview: ${JSON.stringify(txts.slice(0, 150))}...`);
  } catch (e) {
    console.log(`   ❌ Erro: ${e.message}`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("DOCX salvos em:", OUT);
console.log("=".repeat(80));
