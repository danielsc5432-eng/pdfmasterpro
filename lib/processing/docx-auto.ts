import { pdfToDocx } from "./docx";
import { inspectConversionMode, structuralPdfToDocx } from "./pdf2docx";

/** Preserve form geometry; OCR scanned pages; rebuild native flow when appropriate. */
export async function automaticPdfToDocx(input: Uint8Array, name: string) {
  if (await inspectConversionMode(input) === "tables") {
    try { return await structuralPdfToDocx(input, 120000); }
    catch { /* Recover with the positional engine instead of asking for settings. */ }
  }
  return pdfToDocx(input, name, "por+eng");
}
