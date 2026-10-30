# Auditoria SEO do Arquivelio — 29/10/2026

## Estado da entrega

**Atualização após autorização do proprietário:** melhorias publicadas no commit `b2c538d`, deploy `dpl_HRJiMQVSGLepDTHCjmcH9Chdsd82`. As 34 páginas públicas foram conferidas em produção: HTTP 200, canonical e JSON-LD presentes. Os dois domínios antigos redirecionam as páginas com 308, preservando caminho e query. A API de webhook continua sem redirect (GET 405, método não permitido, como esperado). O redirect global do domínio antigo sem www foi removido para evitar salto extra; a regra da aplicação exclui APIs e assets do Next. DNS e identificação de sessões não foram alterados.

**Domínio canônico de produção nesta etapa: `https://www.arquivelio.com.br`.** Mantido para preservar o login Google já configurado. O proprietário informou que não sabe se cadastrou os callbacks sem www. A troca para `https://arquivelio.com.br` depende dessa confirmação no Google Cloud, seguida de atualização coordenada de origem, normalização em `lib/auth/session.ts`, variável SEO e redirect da raiz na Vercel. `SEO_SITE_ORIGIN=https://www.arquivelio.com.br` e `SEO_CANONICAL_REDIRECTS=1` documentam o estado atual. Não ativar a versão sem www sem remover primeiro o redirect raiz → www, pois haveria loop.

Regressão da publicação: **289 testes passaram** e TypeScript passou. `/entrar` responde 200 e mantém o callback Google anterior. Não foi feito login interativo pelo titular. As seções seguintes registram a auditoria original e o plano; a execução atualizada acima prevalece sobre o planejamento.

Lighthouse repetido em produção após publicar: móvel desempenho **89**, acessibilidade **100**, SEO **100**, LCP 1.178 ms e CLS 0; desktop desempenho **100**, acessibilidade **100**, SEO **100**, LCP 335 ms e CLS 0,00258. A nota móvel de desempenho permaneceu 89 nesta execução; não há aumento comprovado dessa pontuação. Relatórios `lighthouse-published-mobile.json` e `lighthouse-published-desktop.json`. Chrome em produção confirmou marca e imagens em 390/1440 px, claro/escuro e sem overflow. Search Console continua sem acesso; sitemap não foi submetido por esta sessão.

## Evidência e escopo

Inspeção do repositório existente: Next.js 16.4.2, React 19, TypeScript, App Router, ferramentas pré-renderizadas e rotas de conta/API dinâmicas; Vercel para o site e processador externo para operações nativas. Processamento local de ferramentas jurídicas/CloneMaster preservado. As dependências instaladas foram reutilizadas; Lighthouse executado em cache separado, sem adicionar dependências ao projeto.

Auditoria pública: 34 URLs do sitemap, todas HTTP 200; 34 sem canonical e sem JSON-LD. Ferramenta inexistente retorna 404; ícones `/icon` e `/apple-icon` retornam 200. HTTPS validado pelo Node, certificado Let's Encrypt YR2 válido de 28/10/2026 a 26/01/2027 (datas UTC). Esta consulta comprova a situação naquele momento, não monitoramento contínuo.

Artefatos privados de teste em `.vercel/review/seo/`: `before.json`, `after.json`, `tls.json`, `build.txt`, `regression.txt` e relatórios Lighthouse JSON. Nenhum documento de usuário foi enviado ou incluído nos testes de SEO.

## Diagnóstico e prioridades

| Problema | Arquivos/área | Impacto | Prioridade | Solução preparada/recomendada | Risco |
|---|---|---|---|---|---|
| Raiz redireciona 308 para www, contrário ao pedido atual | Vercel e `lib/brand.ts` | Sinais conflitantes se apenas os canonicals mudarem | Alta | Base SEO local sem www; inverter domínio principal na publicação autorizada | Alto se mal coordenado |
| Domínio antigo responde 200 na home e em PDF para Word | Configuração pública dos domínios | Conteúdo duplicado e migração sem sinal permanente | Alta | Preparar redirects 301/308 das páginas equivalentes, preservando caminho e query | Médio; excluir callbacks e webhooks |
| 34 páginas sem canonical | `lib/seo.ts`, páginas públicas | Preferência de URL indefinida | Alta | Helper Metadata API por página | Baixo após alinhar domínio |
| Ferramentas herdam compartilhamento da home | Página `[slug]`, layout | Títulos/URLs sociais inadequados | Média | OG/Twitter exclusivos, idioma pt-BR | Baixo |
| Sitemap usa `new Date()` indiscriminadamente | `app/sitemap.ts` | Datas não representam alterações reais | Média | Remover lastmod sem fonte confiável; catálogo ready atualiza lista automaticamente | Baixo |
| Ausência de JSON-LD | Layout e `components/tool-seo.tsx` | Entidades e breadcrumbs menos explícitos | Média | Organization, WebSite, SoftwareApplication, BreadcrumbList | Baixo; sem notas/preços fictícios |
| Históricos/configurações/login sem noindex explícito | Páginas de conta | Indexação de telas sem valor público | Média | noindex nessas páginas, incluindo confirmação de compra | Baixo; não altera acesso |
| Poucas orientações e links relacionados nas ferramentas | `components/tool-seo.tsx` | Dificuldade de descoberta e uso | Média | Tutorial, formatos, revisão e links para rotas reais, após a ferramenta | Baixo |
| Interfaces de todas as famílias importadas pela mesma rota | `[slug]`, `components/tool-renderer.tsx` | Oportunidade de reduzir JS desnecessário | Média | Imports dinâmicos por família, preservando SSR e upload | Médio; validado no navegador |
| Contraste insuficiente em selos | `app/globals.css`, `app/home.css` | Legibilidade | Média | Cores mais escuras no claro e claras no escuro | Baixo |
| Input sem nome e link com nome acessível divergente | `home-dropzone.tsx`, `tool-card.tsx` | Acesso por leitor de tela/voz | Média | Nome no seletor e texto visível como nome do link | Baixo |
| Sem atalho para pular navegação | `app/layout.tsx`, CSS | Trabalho extra no teclado | Média | Link visível ao foco para main | Baixo |
| Logos citados no pedido não existem com nomes PNG | `public/brand/` | Nenhum erro de imagem constatado | Baixa | Preservados JPEGs aprovados, 55.058 e 139.446 bytes, next/image e dimensões explícitas | Baixo |

Não houve problema crítico comprovado. O repositório/chaves de sessão/cookies e compatibilidade ainda contêm identificadores antigos: foram preservados. Assets antigos sem uso público não foram removidos. A inspeção dos módulos públicos não encontrou strings antigas exibidas; relatórios e integrações internos não são títulos SEO.

## Implementação

- `lib/seo.ts`: cadastro das sete páginas institucionais, metadados exclusivos das 27 ferramentas, URLs absolutas, relacionados e serialização de JSON-LD com escape contra fechamento de script.
- `lib/brand.ts`: endereço SEO solicitado sem www, apenas na versão local.
- `app/layout.tsx`: Organization/WebSite e atalho de teclado; idioma existente preservado.
- `app/page.tsx`, `app/ferramentas/page.tsx`, `app/juridico/page.tsx`, `app/precos/page.tsx`, `app/contato/page.tsx`, `app/privacidade/page.tsx`, `app/termos/page.tsx`: metadata individual pelo helper.
- `app/ferramentas/[slug]/page.tsx`, `components/tool-renderer.tsx`, `components/tool-seo.tsx`: metadados, componentes sob demanda e conteúdo complementar. Nenhuma ferramenta nova fictícia ou URL alterada.
- `app/entrar/page.tsx`, `app/criar-conta/page.tsx`, `app/historico/page.tsx`, `app/configuracoes/page.tsx`, `app/precos/obrigado/page.tsx`: noindex. Painel/perfil já tinham noindex.
- `app/sitemap.ts`: mantém a rota e remove datas artificiais. `app/robots.ts` passa a referenciar a base centralizada sem bloquear ferramentas ou assets. Robots não é controle de acesso.
- `components/home-dropzone.tsx`, `components/tool-card.tsx`, `app/globals.css`, `app/home.css`: acessibilidade.
- `scripts/audit-seo.mjs`, `tests/unit/seo.test.ts`: auditoria HTTP/HTML reproduzível e invariantes de SEO.

O domínio antigo, DNS, banco, sessões, callbacks Google e Mercado Pago não foram modificados. Não houve mudança em conversores ou cotas.

## Testes e resultados

| Verificação | Público antes | Build local após |
|---|---:|---:|
| URLs do sitemap com HTTP 200 | 34/34 | 34/34 |
| Páginas com canonical | 0/34 | 34/34 |
| Páginas com JSON-LD | 0/34 | 34/34 |
| Titles/descrições exclusivos na amostra completa | Ver evidência before.json | 34/34 |
| Um H1 por página | Ver evidência before.json | 34/34 |
| Ferramenta inexistente | 404 | 404 |

Build de produção local concluído com TypeScript. **288 testes passaram, zero falhas**, incluindo ferramentas, auth, billing e novos testes SEO. Testes de pagamentos/autenticação são isolados; não houve cobrança ou login real nesta auditoria.

Chrome headless: home com marcas/imagens válidas nos temas claro/escuro, 390/1440 px sem overflow. Seis famílias de ferramentas (`juntar-pdf`, `clonemaster-ai`, `resumir-pdf-ia`, `detector-divergencias`, `pdf-timemachine-juridico`, `contractcheck-ai`) verificadas nas duas larguras: seletor de arquivos, H1 único, canonical e orientações disponíveis; zero exceções JavaScript no roteiro. Isso não equivale a testar manualmente cada controle ou conversão.

JSON-LD validado como JSON, entidades e referências conferidas em testes. Não foi feita validação autenticada pelo Rich Results Test ou Search Console. FAQ visível foi adicionada para usuários; não foi adicionado FAQPage para alegar elegibilidade a resultados enriquecidos.

### Medições de desempenho

Lighthouse 13.6.0, uma execução por perfil/versão. Antes: produção pública; depois: servidor local. **Ambientes diferentes: os resultados não comprovam ganho em produção.** INP e Core Web Vitals de usuários reais não foram medidos. TBT de laboratório não é INP. Os relatórios finais Lighthouse ficam nos JSON `lighthouse-final-mobile.json` e `lighthouse-final-desktop.json`; a tabela consolidada é gerada em `lighthouse-summary.json`.

Antes da correção: móvel desempenho 89, acessibilidade 91, SEO 100, LCP 1.208 ms, CLS 0; desktop desempenho 100, acessibilidade 91, SEO 100, LCP 426 ms, CLS 0,00258. O score SEO 100 coexistia com 34 canonicals ausentes: a pontuação não substitui a auditoria.

| Lighthouse | Desempenho | Acessibilidade | SEO | LCP laboratório | CLS |
|---|---:|---:|---:|---:|---:|
| Público móvel, antes | 89 | 91 | 100 | 1.208 ms | 0 |
| Local móvel, final | 93 | 100 | 100 | 1.072 ms | 0 |
| Público desktop, antes | 100 | 91 | 100 | 426 ms | 0,00258 |
| Local desktop, final | 100 | 100 | 100 | 254 ms | 0,00258 |

Os três problemas binários de acessibilidade identificados antes não aparecem nos relatórios finais da home. Isso não é uma certificação WCAG de todas as páginas. Links internos descobertos nas 34 páginas corresponderam às rotas públicas conhecidas ou a telas reais de conta/ícones; não foram encontrados caminhos internos órfãos nessa amostra.

## Search Console e publicação futura

Sem acesso ao Search Console nesta sessão. Não foram consultados índices, cliques, impressões, sitemaps enviados ou mudança de endereço. O histórico informado de 34 URLs descobertas no domínio antigo não é prova de indexação atual.

Quando autorizar publicar:

1. Confirmar origem principal sem www e ajustar Vercel em conjunto com a publicação; manter o antigo domínio vinculado.
2. Redirecionar páginas HTML antigas para caminhos equivalentes no novo domínio. Não redirecionar indiscriminadamente APIs, OAuth ou webhooks; validar também queries. Não implementar redirects conflitantes em duas camadas.
3. Conferir `APP_PUBLIC_ORIGIN` e os callbacks autorizados no Google antes de alterar a origem funcional. Não renomear identificadores históricos de sessões sem estratégia própria.
4. Rodar `SEO_BASE_URL=https://arquivelio.com.br node scripts/audit-seo.mjs` e verificar que todas as URLs do sitemap respondem diretamente 200, canonicals/OG apontam para si e não existem loops.
5. Na propriedade de domínio `arquivelio.com.br` do Search Console, enviar `https://arquivelio.com.br/sitemap.xml`. Usar Inspeção de URL em poucas páginas representativas; conferir canonical declarada/escolhida, indexação e HTTPS.
6. Na propriedade antiga, verificar se Mudança de endereço já foi usada e se é aplicável à migração entre domínios depois de estabelecer redirects permanentes. Não refazer uma solicitação já correta nem solicitar indexação repetidamente.
7. Repetir Lighthouse/PageSpeed em produção e acompanhar dados de campo de LCP/INP/CLS quando houver amostra suficiente. Não prometer posição, prazo de aprovação AdSense ou resultados enriquecidos.

Recomendações contínuas: novas ferramentas devem entrar no catálogo com capacidade real e status correto; títulos, descrições, rotas, relacionados e schema são verificados pelos testes. Revisar conteúdo quando capacidades/limites mudarem. Auditoria de dependências e segurança aprofundada ficam como trabalho separado; esta revisão verificou a reutilização das validações e não é um pentest.

## Referências oficiais consultadas

- [Google: canonicalização e sinais](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: sitemap e lastmod verificável](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: redirecionamentos](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [Google: mudança de domínio](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Google: elegibilidade de FAQ](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- Documentação Next.js instalada: Metadata API e lazy-loading em `node_modules/next/dist/docs/01-app/`.
