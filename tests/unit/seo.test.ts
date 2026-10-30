import test from "node:test";
import assert from "node:assert/strict";
import { publicPaths, publicPages, publicMetadata, toolMetadata, relatedTools, toolStructuredData, serializeJsonLd, indexableTools } from "../../lib/seo";
import sitemap from "../../app/sitemap";
import robots from "../../app/robots";
test("SEO public routes have unique canonical, title, description and complete share metadata",()=>{
 const entries=[...publicPages.map(p=>publicMetadata(p.path)),...indexableTools().map(toolMetadata)];
 for(const entry of entries){assert.ok(entry.description);assert.match(String(entry.alternates?.canonical),/^https:\/\/arquivelio\.com\.br\//);assert.equal(entry.openGraph?.url,entry.alternates?.canonical);assert.ok(entry.twitter);}
 assert.equal(new Set(entries.map(e=>JSON.stringify(e.title))).size,entries.length);
 assert.equal(new Set(entries.map(e=>e.description)).size,entries.length);
 assert.deepEqual(sitemap().map(e=>new URL(e.url).pathname),publicPaths());
 assert.ok(sitemap().every(e=>!e.lastModified));
 assert.equal(robots().sitemap,"https://arquivelio.com.br/sitemap.xml");
 assert.ok(!publicPaths().some(p=>/api|perfil|historico|obrigado|entrar|criar-conta/.test(p)));
});
test("structured data and related tools use real routes without invented ratings or prices",()=>{
 const paths=new Set(publicPaths());
 for(const tool of indexableTools()){
 assert.ok(relatedTools(tool).every(t=>t.slug!==tool.slug&&paths.has(`/ferramentas/${t.slug}`)));
 const data=toolStructuredData(tool);assert.equal(data[0].name,tool.name);const text=serializeJsonLd(data);assert.doesNotMatch(text,/aggregateRating|reviewCount|priceCurrency/);assert.doesNotThrow(()=>JSON.parse(text));
 }
 assert.ok(!serializeJsonLd({text:"</script><script>alert(1)</script>"}).includes("<"));
});
