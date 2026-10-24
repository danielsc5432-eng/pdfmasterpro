import path from "node:path";
import { execFile } from "./system";
import type { LayoutPage } from "./layout";

export async function readNativeLayout(source: string): Promise<LayoutPage[]> {
  const python=process.env.PDF_TO_WORD_PYTHON||(process.platform==="win32"?"python":"python3");
  const {stdout}=await execFile(python,[path.join(process.cwd(),"scripts","pdf-native-layout.py"),source],{timeout:60000,windowsHide:true,maxBuffer:64*1024*1024,env:{...process.env,OMP_NUM_THREADS:"1"}});
  const pages=JSON.parse(stdout) as LayoutPage[];
  if(!Array.isArray(pages)||!pages.length||pages.some(p=>!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<=0||p.height<=0||!Array.isArray(p.texts)||!Array.isArray(p.images)))throw new Error("Invalid native layout");
  return pages;
}
