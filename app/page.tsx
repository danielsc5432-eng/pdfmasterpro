import Link from "next/link";
import { ArrowRight, CheckCircle2, FileCheck2, Lock, Sparkles, Zap } from "lucide-react";
import { ToolCard } from "@/components/tool-card";
import { HomeDropzone } from "@/components/home-dropzone";
import { tools } from "@/lib/tools/catalog";

export default function HomePage() {
  const popular = tools.filter((tool) => tool.popular);
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> Espaço de trabalho para documentos</span>
            <h1>Tudo o que você precisa para trabalhar com <em>PDFs.</em></h1>
            <p className="hero-copy">Converta, comprima, edite, organize e proteja seus documentos em poucos cliques — com uma experiência clara, rápida e feita para respeitar seus arquivos.</p>
            <div className="hero-actions"><Link className="button button-primary" href="/ferramentas/juntar-pdf">Escolher uma ferramenta <ArrowRight size={16} /></Link><Link className="button button-ghost" href="/ferramentas">Explorar ferramentas</Link></div>
            <div className="hero-note"><Lock size={15} /> Seus arquivos temporários são tratados conforme a política de retenção configurada.</div>
          </div>
          <div className="hero-art"><div className="hero-orbit" aria-hidden="true" /><HomeDropzone /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="popular-heading">
        <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> Comece por aqui</span><h2 id="popular-heading">Ferramentas populares</h2><p>Fluxos diretos para as tarefas que mais aparecem no seu dia a dia.</p></div><Link className="text-link" href="/ferramentas">Ver catálogo completo <ArrowRight size={14} style={{ verticalAlign: "middle" }} /></Link></div>
        <div className="tool-grid">{popular.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}</div>
      </section>

      <section className="section" aria-labelledby="why-heading">
        <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> Do arquivo ao resultado</span><h2 id="why-heading">Trabalhe sem adivinhar o que está acontecendo.</h2></div></div>
        <div className="feature-band"><div className="feature-card"><Zap size={22} /><h3>Fluxos rápidos</h3><p>Escolha a ferramenta, veja os formatos e siga uma sequência curta até o download.</p></div><div className="feature-card"><FileCheck2 size={22} /><h3>Resultados honestos</h3><p>O botão de download só aparece quando o arquivo foi processado e verificado de verdade.</p></div><div className="feature-card"><Lock size={22} /><h3>Privacidade no centro</h3><p>Limites, retenção e configurações aparecem antes da tarefa, sem letras miúdas.</p></div></div>
      </section>

      <section className="section" aria-labelledby="how-heading">
        <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> Como funciona</span><h2 id="how-heading">Três passos, zero surpresa.</h2></div></div>
        <div className="feature-band"><div className="feature-card"><span className="eyebrow">01</span><h3>Escolha a ferramenta</h3><p>Veja o que cada fluxo faz, os formatos aceitos e se algum motor externo é necessário.</p></div><div className="feature-card"><span className="eyebrow">02</span><h3>Envie e configure</h3><p>Valide arquivos, ordene páginas e escolha opções com feedback acessível.</p></div><div className="feature-card"><span className="eyebrow">03</span><h3>Baixe com clareza</h3><p>Receba um resultado real, confira o status e saiba por quanto tempo ele ficará disponível.</p></div></div>
      </section>

      <section className="section" aria-labelledby="faq-heading"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={13} /> Perguntas frequentes</span><h2 id="faq-heading">Antes de começar</h2></div></div><div className="faq-grid"><details><summary>Posso usar sem criar conta?</summary><p>Sim, as ferramentas essenciais da primeira fase funcionam em modo convidado dentro dos limites indicados na tela.</p></details><details><summary>O que acontece com meus arquivos?</summary><p>Os fluxos atuais processam os arquivos durante a requisição e informam a política de retenção. Storage privado e limpeza física por worker entram na fase de produção.</p></details><details><summary>A compressão está disponível?</summary><p>A compressão só conclui quando Ghostscript estiver instalado e acessível. Se o motor não estiver configurado, o produto informa isso em vez de fabricar uma redução.</p></details></div></section>

      <section className="section"><div className="cta-panel"><div><h2>Um espaço mais claro para seus documentos.</h2><p>Comece com as ferramentas essenciais e evolua para uma conta quando quiser histórico e limites maiores.</p></div><Link className="button" style={{ background: "white", color: "#5B5BD6" }} href="/ferramentas">Explorar ferramentas <ArrowRight size={16} /></Link></div></section>
    </>
  );
}
