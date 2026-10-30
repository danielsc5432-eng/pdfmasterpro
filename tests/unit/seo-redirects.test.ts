import test from 'node:test';
import assert from 'node:assert/strict';
const { match } = require('next/dist/compiled/path-to-regexp') as { match: (pattern: string) => (path: string) => false | { params: Record<string, string> } };
import { seoRedirects } from '../../lib/seo-redirects';
test('canonical redirects preserve paths and exclude API/callbacks/assets',()=>{
 assert.deepEqual(seoRedirects({}),[]);
 const transitional = seoRedirects({SEO_CANONICAL_REDIRECTS:'1',SEO_SITE_ORIGIN:'https://www.arquivelio.com.br'});
 assert.equal(transitional.length,2);assert.ok(transitional.every(r=>r.destination==='https://www.arquivelio.com.br/:path'&&!r.has.some(h=>h.value==='www.arquivelio.com.br')));
 const routes=seoRedirects({SEO_CANONICAL_REDIRECTS:'1'});assert.equal(routes.length,3);
 for(const route of routes){
 assert.equal(route.permanent,true);assert.ok(!route.has.some(x=>x.value==='arquivelio.com.br'));
 const matcher=match(route.source);
 for(const p of ['/','/ferramentas/pdf-para-word','/contato'])assert.ok(matcher(p));
 for(const p of ['/api','/api/billing/webhook','/api/auth/google/callback','/_next/static/file.js'])assert.equal(matcher(p),false);
 }
});
