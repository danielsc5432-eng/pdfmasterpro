import { readFile, writeFile } from 'fs/promises';
import { pdfToDocx } from './lib/processing/docx.ts';
const files = ["01_tabela_complexa", "02_duas_colunas", "03_formulario_listas", "04_artigo_cientifico", "05_tabela_larga_landscape"];
for (const f of files) {
  const b = await readFile(process.env.TEMP + '/opencode/pdf-word-testes/' + f + '.pdf');
  const d = await pdfToDocx(new Uint8Array(b), f + '.pdf');
  await writeFile(process.env.TEMP + '/opencode/pdf-word-testes/local-' + f + '.docx', Buffer.from(d));
  console.log(f, d.length);
}
