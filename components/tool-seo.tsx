import Link from "next/link";
import type { ToolDefinition } from "@/lib/tools/catalog";
import { relatedTools, serializeJsonLd, toolStructuredData } from "@/lib/seo";
export function ToolSeo({ tool }: { tool: ToolDefinition }) {
 const clone = tool.slug === "clonemaster-ai";
 return <section className="section tool-guide" aria-label={`Orientações: ${tool.name}`}>
 <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(toolStructuredData(tool)) }} />
 <h2>Como usar: {tool.name}</h2>
 <ol><li>{clone ? "Selecione o modelo TXT, INI ou CFG e a planilha XLSX com os dados." : `Selecione os arquivos nos formatos aceitos: ${tool.formats.join(", ")}.`}</li><li>{clone ? "Escolha as colunas e os campos de destino e confira a prévia antes de gerar." : "Ajuste as opções exibidas na ferramenta, confira os limites e inicie o processamento."}</li><li>Revise o resultado antes de baixar ou compartilhar. Mantenha uma cópia do arquivo original.</li></ol>
 <h2>Recursos e formatos de {tool.name}</h2><p>{tool.description}</p><ul>{tool.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
 <h2>Perguntas frequentes sobre {tool.name}</h2>
 <details><summary>Quais formatos posso usar nesta ferramenta?</summary><p>{tool.formats.join(" · ")}. Confira também as opções e os limites de tamanho e quantidade exibidos na área de arquivos.</p></details>
 <details><summary>O que devo conferir no resultado?</summary><p>{clone ? "Confira os campos substituídos, a codificação e os valores da planilha. Tabelas de largura fixa não convertem moedas automaticamente." : tool.category === "Jurídico" || tool.category === "Analisar" ? "Confira as páginas e os trechos citados. Uma análise automática pode omitir ou interpretar incorretamente informações e não substitui a revisão profissional." : "Confira o conteúdo, a ordem das páginas e a formatação. Documentos com fontes, imagens ou estruturas complexas podem exigir ajustes."}</p></details>
 <h2>Ferramentas relacionadas</h2><ul>{relatedTools(tool).map(other => <li key={other.slug}><Link href={`/ferramentas/${other.slug}`}>{other.name}</Link> — {other.description}</li>)}</ul>
 </section>;
}
