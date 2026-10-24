import { layoutSections, pdfToDocx } from "../processing/docx";
import { Document, Packer } from "docx";
import { renderDirectional } from "./directional";
import { renderPageGrid } from "./page-grid";

/** Extract Unicode geometry independently from Poppler; choose a compatible renderer. */
export function nativePdfToDocx(input:Uint8Array,name:string) {
  return pdfToDocx(input,name,"por+eng",async context=>{
    if(context.pages.some(page=>page.texts.some(item=>[90,270].includes(item.rotation??0))))return renderDirectional(context);
    try{return await renderPageGrid(context);}
    catch{return new Uint8Array(await Packer.toBuffer(new Document({creator:"PDF Master Pro SDK",sections:layoutSections(context.pages,context.assets,context.artwork)})));}
  },"native");
}
