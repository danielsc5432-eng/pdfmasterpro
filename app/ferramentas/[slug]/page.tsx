import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ToolIcon } from "@/components/icons";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getTool, tools } from "@/lib/tools/catalog";

export async function generateStaticParams() { return tools.map((tool) => ({ slug: tool.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const tool = getTool((await params).slug); return tool ? { title: tool.name, description: tool.description } : { title: "Ferramenta não encontrada" }; }

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug);
  if (!tool) notFound();
  return <><section className="tool-hero"><div className="tool-hero-inner"><div className="breadcrumbs"><a href="/ferramentas">Ferramentas</a><ChevronRight size={13} /><span>{tool.category}</span></div><div className="tool-title-row"><div className="tool-title-icon"><ToolIcon name={tool.icon} size={26} /></div><div><h1>{tool.name}</h1><p>{tool.description}</p></div></div></div></section><div className="tool-layout"><ToolWorkspace tool={tool} /><aside className="tool-sidebar"><div className="sidebar-card"><h3>O que você pode fazer</h3><ul>{tool.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div><div className="sidebar-card"><h3>Formatos</h3><p>{tool.formats.join(" · ")}</p></div><div className="sidebar-card"><h3>Privacidade</h3><p>Nesta versão o resultado é devolvido na sessão e não fica persistido em histórico. A retenção de 2 horas e a deleção física serão aplicadas quando storage privado e worker forem habilitados.</p></div></aside></div></>;
}
