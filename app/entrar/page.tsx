import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
export const metadata: Metadata = { title: "Entrar", description: "Acesse sua conta PDF Master Pro." };
export default function SignInPage() { return <div className="page-shell"><div className="empty-panel auth-panel"><div className="tool-card-icon" style={{ margin: "0 auto" }}><LockKeyhole size={22} /></div><h1>Entrar no PDF Master Pro</h1><p>Use sua conta Manus para acessar o painel, histórico e preferências. O primeiro login cria seu perfil automaticamente.</p><a className="button button-primary" href="/api/auth/login">Continuar com Manus</a><div className="auth-note"><ShieldCheck size={16} /><span>Não armazenamos sua senha. A autenticação ocorre no provedor Manus.</span></div><p className="auth-switch">Ainda não tem perfil? <Link href="/criar-conta">Criar conta</Link></p></div></div>; }
