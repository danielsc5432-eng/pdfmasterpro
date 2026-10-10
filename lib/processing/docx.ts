import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Document, Packer, Paragraph, TextRun } from "docx";

const execFile = promisify(execFileCallback);

async function commandExists(command: string) {
  try { await execFile("which", [command]); return true; } catch { return false; }
}

export async function pdfToDocx(input: Uint8Array) {
  if (!(await commandExists("pdftotext"))) throw new Error("O extrator de texto PDF não está configurado neste servidor.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "pdfmaster-docx-"));
  const inputPath = path.join(directory, "input.pdf");
  const textPath = path.join(directory, "extracted.txt");
  try {
    await writeFile(inputPath, input);
    await execFile("pdftotext", ["-layout", "-enc", "UTF-8", inputPath, textPath], { timeout: 120000 });
    const text = await readFile(textPath, "utf8");
    if (!text.replace(/\s/g, "").length) throw new Error("Este PDF não contém texto extraível. OCR será necessário para documentos digitalizados.");
    const pages = text.replace(/\r\n/g, "\n").split("\f");
    const children: Paragraph[] = [];
    pages.forEach((page, pageIndex) => {
      const lines = page.replace(/\n+$/, "").split("\n");
      lines.forEach((line, lineIndex) => children.push(new Paragraph({ pageBreakBefore: pageIndex > 0 && lineIndex === 0, spacing: { after: 0, line: 240 }, children: [new TextRun({ text: line || " " })] })));
    });
    const document = new Document({ creator: "PDF Master Pro", title: "Texto extraído de PDF", description: "Documento DOCX gerado a partir do texto extraível de um PDF.", sections: [{ children }] });
    return new Uint8Array(await Packer.toBuffer(document));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
