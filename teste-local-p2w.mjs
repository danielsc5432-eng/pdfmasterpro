import { readFile, writeFile } from 'fs/promises';
import { pdfToDocx } from './lib/processing/docx.ts';
const b = await readFile(process.env.TEMP + '/opencode/pdf-word-testes/01_tabela_complexa.pdf');
const d = await pdfToDocx(new Uint8Array(b), '01_tabela_complexa.pdf');
await writeFile(process.env.TEMP + '/opencode/pdf-word-testes/local-test.docx', Buffer.from(d));
console.log('ok', d.length);
