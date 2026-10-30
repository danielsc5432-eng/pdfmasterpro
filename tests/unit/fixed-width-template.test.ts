import test from 'node:test';
import assert from 'node:assert/strict';
import { readTextTemplate, renderTextTemplate, encodeText } from '../../lib/clonemaster/text-template';
test('fixed-width records preserve columns, CRLF and untouched bytes in all supported encodings',()=>{
 const original='1234                    PESSOA EXEMPLO A                                 95318    \r\n1235                    PESSOA EXEMPLO B                                138500    \r\n';
 for(const encoding of ['utf-8','utf-16le','utf-16be','windows-1252'] as const){
 const input=encodeText(original,encoding),t=readTextTemplate('t','verbas.txt.txt',input,encoding);
 assert.equal(t.fields.length,2);assert.equal(t.fields[0].key,'1234');
 assert.deepEqual(renderTextTemplate(t,[{field:t.fields[0].id,value:'95318'}]),input);
 const out=renderTextTemplate(t,[{field:t.fields[0].id,value:'42'}]);
 assert.equal(out.length,input.length);
 assert.equal(new TextDecoder(encoding).decode(out),original.replace('95318','   42'));
 assert.throws(()=>renderTextTemplate(t,[{field:t.fields[0].id,value:'1'.repeat(60)}]),/largura/);
 assert.throws(()=>renderTextTemplate(t,[{field:t.fields[0].id,value:'1,23'}]),/inteiro/);
 }
});
test('ambiguous or inconsistent tables are rejected rather than guessing columns',()=>{
 for(const text of ['123  NAME  42\n124   NAME  42','123  NAME  42\ninvalid row'])assert.throws(()=>readTextTemplate('t','x.txt',encodeText(text,'utf-8')),/campos editáveis/);
});
