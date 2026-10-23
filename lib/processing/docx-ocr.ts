import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { LayoutPage, LayoutTextItem } from "./layout";
import { transparentPaper } from "./docx-artwork";
import { commandExists, execFile } from "./system";

export type OcrWord = { text: string; x: number; y: number; width: number; height: number; confidence: number; line: string };

export function parseOcrTsv(tsv: string): OcrWord[] {
  const words: OcrWord[] = [];
  for (const line of tsv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    const fields = line.split("\t");
    if (fields.length < 12 || fields[0] !== "5") continue;
    const [x, y, width, height, confidence] = fields.slice(6,11).map(Number);
    const text = fields.slice(11).join("\t").trim();
    if (!text || ![x,y,width,height,confidence].every(Number.isFinite) || x<0 || y<0 || width<=0 || height<=0 || confidence<0) continue;
    words.push({text,x,y,width,height,confidence,line:fields.slice(1,5).join(":")});
  }
  return words;
}

export function needsPageOcr(page: LayoutPage) {
  const words = page.texts.reduce((count,item)=>count+item.words.length,0);
  return words < 8 && page.images.some(image=>image.width*image.height >= page.width*page.height*0.5);
}

/** Replace scanned glyphs with editable words instead of drawing text twice. */
export function ocrPageLayout(words: OcrWord[], width: number, height: number, pixelWidth: number, pixelHeight: number, measure?: (text: string) => number): LayoutTextItem[] {
  const groups = new Map<string,OcrWord[]>();
  for (const word of words) { const group=groups.get(word.line)??[]; group.push(word); groups.set(word.line,group); }
  const sx=width/pixelWidth, sy=height/pixelHeight;
  return [...groups.values()].flatMap(group=>{
    group.sort((a,b)=>a.x-b.x);
    const y=Math.min(...group.map(w=>w.y));
    const bottom=Math.max(...group.map(w=>w.y+w.height));
    const heights=group.map(w=>w.height).sort((a,b)=>a-b);
    const estimates=measure ? group.flatMap(w=>{try { const units=measure(w.text);return units>0?[w.width*sx/units]:[]; }catch{return []}}).sort((a,b)=>a-b) : [];
    const size=Math.max(4,estimates.length?estimates[Math.floor(estimates.length/2)]:heights[0]*sy/0.75);
    return group.map(word=>({x:word.x*sx,y:y*sy,width:word.width*sx,height:(bottom-y)*sy,
      font:{family:"Arial",size,color:"#000000",bold:false,italic:false},
      words:[{text:word.text,x:word.x*sx,width:word.width*sx,bold:false,italic:false}],
      segments:[{text:word.text,bold:false,italic:false}]}));
  });
}

export function eraseRecognizedInk(png: PNG, words: OcrWord[]) {
  for (const word of words) {
    const left=Math.max(0,Math.floor(word.x)-1),right=Math.min(png.width,Math.ceil(word.x+word.width)+1);
    const top=Math.max(0,Math.floor(word.y)-1),bottom=Math.min(png.height,Math.ceil(word.y+word.height)+1);
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
      const index=(y*png.width+x)*4;
      png.data[index]=png.data[index+1]=png.data[index+2]=255;
      png.data[index+3]=0;
    }
  }
}

export async function recognizeScannedPages(pages: LayoutPage[], inputPath: string, directory: string, language = "por+eng") {
  const artwork=new Map<number,Uint8Array>();
  const selected=pages.map((page,index)=>({page,index})).filter(({page})=>needsPageOcr(page));
  if(!selected.length)return artwork;
  if(!["por","eng","por+eng"].includes(language))throw new Error("O idioma do OCR deve ser português, inglês ou ambos.");
  const engine=process.env.OCR_ENGINE||"tesseract",renderer=process.env.PDF_RENDERER||"pdftoppm";
  if(!(await commandExists(engine)) || !(await commandExists(renderer)))throw new Error("O OCR para PDF digitalizado não está configurado neste servidor.");
  const {stdout:languages}=await execFile(engine,["--list-langs"],{timeout:15000,windowsHide:true});
  const installed=new Set(languages.split(/\r?\n/).map(line=>line.trim()));
  if(language.split("+").some(lang=>!installed.has(lang)))throw new Error("O idioma selecionado para OCR não está instalado neste servidor.");
  const metrics=await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  for(const {page,index}of selected){
    // Bound image memory while preferring the 300 dpi recommended by Tesseract.
    const dpi=Math.min(300,Math.max(72,Math.floor(Math.sqrt(18000000/(page.width*page.height))*72)));
    const prefix=path.join(directory,`ocr-${index}`);
    await execFile(renderer,["-f",String(index+1),"-l",String(index+1),"-png","-r",String(dpi),inputPath,prefix],{timeout:120000,windowsHide:true});
    const name=(await readdir(directory)).find(name=>name.startsWith(`ocr-${index}-`)&&name.endsWith(".png"));
    if(!name)throw new Error(`O renderizador não produziu a página ${index+1} para OCR.`);
    const image=path.join(directory,name),base=path.join(directory,`recognized-${index}`);
    await execFile(engine,[image,base,"-l",language,"--dpi",String(dpi),"--psm","3","-c","tessedit_create_tsv=1"],{timeout:180000,windowsHide:true,maxBuffer:4*1024*1024,env:{...process.env,OMP_THREAD_LIMIT:"1"}});
    const words=parseOcrTsv(await readFile(`${base}.tsv`,"utf8"));
    if(!words.length)throw new Error(`O OCR não encontrou texto legível na página ${index+1}.`);
    const png=PNG.sync.read(await readFile(image));
    page.texts=ocrPageLayout(words,page.width,page.height,png.width,png.height,text=>metrics.widthOfTextAtSize(text,1));
    page.images=[];
    eraseRecognizedInk(png,words);
    artwork.set(index,transparentPaper(PNG.sync.write(png)));
    await rm(image,{force:true});
  }
  return artwork;
}
