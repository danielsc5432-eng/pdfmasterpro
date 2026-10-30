import type { Metadata } from "next";
import { BRAND_NAME, BRAND_SITE_URL } from "./brand";
import { tools, type ToolDefinition } from "./tools/catalog";
export const publicPages = [
 { path: "/", title: "Ferramentas PDF Online e Inteligência Artificial", description: "Compare documentos, converta, organize e resuma PDFs com o Arquivelio. Conheça as ferramentas, os formatos aceitos e os limites de cada tarefa." },
 { path: "/ferramentas", title: "Ferramentas PDF Online", description: "Encontre ferramentas para converter, organizar, otimizar, analisar e proteger PDFs. Consulte formatos, recursos e limites antes de enviar seus arquivos." },
 { path: "/juridico", title: "Ferramentas Jurídicas para Documentos", description: "Compare versões de contratos, organize documentos e examine alterações com evidências. Ferramentas jurídicas com revisão humana e processamento local." },
 { path: "/precos", title: "Planos e preços", description: "Confira as cotas do plano gratuito e as opções Premium do Arquivelio. Consulte os preços e condições antes de contratar." },
 { path: "/contato", title: "Contato e ajuda", description: "Encontre orientações para usar as ferramentas do Arquivelio e entre em contato com o atendimento para relatar dificuldades." },
 { path: "/privacidade", title: "Política de privacidade", description: "Entenda o tratamento dos dados da conta, documentos, arquivos temporários e recursos opcionais de IA no Arquivelio." },
 { path: "/termos", title: "Termos de uso", description: "Consulte as condições de uso do Arquivelio, os limites das ferramentas e as responsabilidades na revisão dos resultados." },
] as const;
export const seoUrl = (path: string) => new URL(path, BRAND_SITE_URL).href;
export function pageMetadata(path: string, title: string, description: string): Metadata {
 const fullTitle = `${title} | ${BRAND_NAME}`, url = seoUrl(path);
 const images = [{ url: seoUrl("/brand/arquivelio-horizontal.jpeg"), width: 1599, height: 578, alt: BRAND_NAME }];
 return { title: { absolute: fullTitle }, description, alternates: { canonical: url }, openGraph: { type: "website", locale: "pt_BR", title: fullTitle, description, url, siteName: BRAND_NAME, images }, twitter: { card: "summary_large_image", title: fullTitle, description, images: images.map(image => image.url) } };
}
export function publicMetadata(path: string) { const entry = publicPages.find(page => page.path === path); if (!entry) throw Error("Página SEO não cadastrada"); return pageMetadata(path, entry.title, entry.description); }
export function toolMetadata(tool: ToolDefinition) { return pageMetadata(`/ferramentas/${tool.slug}`, tool.slug === "clonemaster-ai" ? "CloneMaster AI — Automação de Modelos TXT" : `${tool.name} Online`, tool.description); }
export const indexableTools = () => tools.filter(tool => tool.status === "ready");
export const publicPaths = () => [...publicPages.map(page => page.path), ...indexableTools().map(tool => `/ferramentas/${tool.slug}`)];
export function relatedTools(tool: ToolDefinition) { return indexableTools().filter(other => other.slug !== tool.slug).sort((a,b) => Number(b.category === tool.category) - Number(a.category === tool.category)).slice(0,3); }
export function toolStructuredData(tool: ToolDefinition) {
 const url = seoUrl(`/ferramentas/${tool.slug}`), legal = tool.category === "Jurídico", parent = legal ? "/juridico" : "/ferramentas";
 return [{ "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": `${url}#application`, name: tool.name, url, description: tool.description, applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "pt-BR", featureList: tool.features, publisher: { "@id": `${seoUrl("/")}#organization` } },
 { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: BRAND_NAME, item: seoUrl("/") }, { "@type": "ListItem", position: 2, name: legal ? "Jurídico" : "Ferramentas", item: seoUrl(parent) }, { "@type": "ListItem", position: 3, name: tool.name, item: url }] }];
}
export function serializeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
