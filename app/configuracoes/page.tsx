import Link from "next/link";

export const metadata = { title: "Configurações", description: "Preferências e segurança da sua conta PDF Master Pro." };

export default function SettingsPage() { return <div className="page-shell"><div className="page-header"><span className="eyebrow"><span className="eyebrow-dot" /> Preferências</span><h1>Configurações da conta em preparação.</h1><p>Tema, idioma, sessões, exclusão de conta e preferências de privacidade serão gerenciados aqui quando a autenticação estiver ativa.</p></div><div className="empty-panel"><Link className="button button-ghost" href="/privacidade">Ler política de privacidade</Link></div></div>; }
