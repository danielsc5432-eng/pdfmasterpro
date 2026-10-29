import test from 'node:test';
import assert from 'node:assert/strict';
import { readTextTemplate, renderTextTemplate } from '../../lib/clonemaster/text-template';
import { summarizeExtracted, validateSummaryPoints } from '../../lib/summary/engine';

test('TXT colon/tab fields preserve all bytes outside replaced values', () => {
 const original='Título sem campos\r\nNome: Daniel\r\nValor\t123,45\r\n';
 const template=readTextTemplate('t','verbas.txt',new TextEncoder().encode(original));
 assert.deepEqual(template.fields.map(f=>f.key),['Nome','Valor']);
 const out=renderTextTemplate(template,[{field:template.fields[1].id,value:'456,78'}]);
 assert.equal(new TextDecoder().decode(out),original.replace('123,45','456,78'));
 assert.throws(()=>readTextTemplate('t','file.txt',new TextEncoder().encode('Texto livre sem campos')),/campos editáveis/);
});
test('summary accepts equivalent Unicode but rejects changed quotation numbers',()=>{
 const sources=[{id:'p1s1',page:1,text:'O café custa R$ 10,00 no contrato.'}];
 const data=(quote:string)=>JSON.stringify({points:[{text:'O café custa R$ 10,00.',evidence:[{sourceId:'p1s1',quote}]}]});
 assert.equal(validateSummaryPoints(data(sources[0].text.normalize('NFD')),sources).length,1);
 assert.throws(()=>validateSummaryPoints(data(sources[0].text.replace('10,00','20,00')),sources),/citação/);
});
test('summary retries invalid evidence once and never delivers a second invalid response',async()=>{
 const saved={...process.env};
 Object.assign(process.env,{SUMMARY_AI_PROVIDER:'ollama',SUMMARY_OLLAMA_URL:'http://localhost:11434',SUMMARY_STANDARD_MODEL:'test'});
 try {
 const input={name:'test.pdf',totalPages:1,pages:[{number:1,ocr:false,text:'O contrato exige pagamento em 10 dias.'}]};
 const options={length:'short',mode:'standard',instructions:'',pages:'',consent:true} as const;
 let calls=0;
 const valid=JSON.stringify({points:[{text:input.pages[0].text,evidence:[{sourceId:'p1s1',quote:input.pages[0].text}]}]});
 const invalid=valid.replaceAll('10 dias','20 dias');
 const result=await summarizeExtracted(input,options,new AbortController().signal,()=>{},async()=>++calls===1?invalid:valid);
 assert.equal(calls,2);assert.equal(result.usage.calls,2);assert.equal(result.points.length,1);
 assert.equal(result.warnings.some(w=>w.includes('reserva')),false);
 calls=0;
 await assert.rejects(summarizeExtracted(input,options,new AbortController().signal,()=>{},async()=>{calls++;return invalid;}),/citação/);
 assert.equal(calls,2);
 }finally{process.env=saved;}
});
