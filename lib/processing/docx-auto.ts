import { pdfToDocx } from "./docx";
import { inspectConversionMode, structuralPdfToDocx } from "./pdf2docx";
import { betterFidelity, checkDocxFidelity, fidelityStatus, unsafeFidelity } from "./docx-fidelity";
import { configuredExtraEngines, extraEngineToWord } from "./extra-engines";
import { renderPageGrid } from "../pdf-sdk/page-grid";

/** Preserve form geometry; OCR scanned pages; rebuild native flow when appropriate. */
export async function checkedPdfToDocx(input: Uint8Array, name: string) {
  const deadline = Date.now() + 260000;
  let mode = await inspectConversionMode(input);
  let output: Uint8Array;
  if (mode === "tables") {
    try { output = await structuralPdfToDocx(input, 120000); }
    catch { mode = "layout"; output = await pdfToDocx(input,name,"por+eng"); }
  } else output = await pdfToDocx(input,name,"por+eng");
  let report = await checkDocxFidelity(input,output,Math.min(90000,deadline-Date.now()));
  if (report && fidelityStatus(report) === "review" && deadline-Date.now()>60000) {
    try {
      const grid = await pdfToDocx(input,name,"por+eng",renderPageGrid);
      const measured = await checkDocxFidelity(input,grid,Math.min(60000,deadline-Date.now()));
      if (measured && betterFidelity(measured,report)) { output=grid; report=measured; }
    } catch { /* Retain the measured baseline if flow reconstruction cannot preserve geometry. */ }
  }
  const extras = configuredExtraEngines();
  for (let index = 0; index < extras.length; index++) {
    if (fidelityStatus(report) === "checked") break;
    const budget = Math.floor((deadline-Date.now()) / (extras.length-index));
    if (budget < 15000) break;
    try {
      const candidate = await extraEngineToWord(extras[index], input, Math.min(60000, Math.floor(budget/2)));
      const measured = await checkDocxFidelity(input,candidate,Math.min(60000,deadline-Date.now(),Math.floor(budget/2)));
      // An unmeasured external result must never replace the existing conversion.
      if (measured && (!report || betterFidelity(measured,report))) { output=candidate; report=measured; }
    } catch { /* An unavailable optional service must not interrupt local conversion. */ }
  }
  if (report && fidelityStatus(report) === "review" && !report.ocrReview && deadline-Date.now()>60000) {
    try {
      const alternate = mode === "layout" ? await structuralPdfToDocx(input, Math.min(120000,Math.floor((deadline-Date.now())/2))) : await pdfToDocx(input,name,"por+eng");
      const measured = await checkDocxFidelity(input,alternate,Math.min(90000,deadline-Date.now()));
      if (measured && betterFidelity(measured,report)) { output=alternate; report=measured; }
    } catch { /* Keep the candidate whose fidelity was actually measured. */ }
  }
  if (!report) throw new Error("A conferência de qualidade não pôde ser concluída. Tente novamente para gerar um Word verificado.");
  if (unsafeFidelity(report)) throw new Error("A conferência detectou diferenças nas páginas, textos, números ou layout. Não foi possível gerar um Word confiável para este PDF.");
  return { output, report, status: fidelityStatus(report) };
}

export async function automaticPdfToDocx(input: Uint8Array, name: string) {
  return (await checkedPdfToDocx(input,name)).output;
}
