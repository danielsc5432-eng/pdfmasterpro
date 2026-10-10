import { Search } from "lucide-react";
import { ToolCard } from "@/components/tool-card";
import { categories, tools } from "@/lib/tools/catalog";

export const metadata = { title: "Ferramentas para PDF", description: "Explore o catálogo de ferramentas do PDF Master Pro." };

type SearchParams = Promise<{ busca?: string }>;

export default async function ToolsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.busca ?? "").trim().toLowerCase();
  const filtered = query ? tools.filter((tool) => `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(query)) : tools;
  return <div className="page-shell"><div className="page-header"><span className="eyebrow"><span className="eyebrow-dot" /> Catálogo de ferramentas</span><h1>Encontre o fluxo certo para o seu PDF.</h1><p>Do primeiro upload ao arquivo final, cada ferramenta explica seus formatos, capacidades e limites antes de começar.</p></div><div className="category-row" style={{ marginTop: 32 }} aria-label="Categorias">{categories.map((category) => <span className="category-pill" key={category}>{category}</span>)}</div>{query && <div className="alert" style={{ maxWidth: 1180, margin: "0 auto 18px" }}><Search size={16} /> Mostrando resultados para “{params.busca}”.</div>}{filtered.length > 0 ? <div className="tool-grid">{filtered.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}</div> : <div className="empty-panel"><Search size={24} color="var(--muted)" /><h2>Nenhuma ferramenta encontrada</h2><p>Tente buscar por “PDF”, “imagem” ou “organizar”.</p></div>}</div>;
}
