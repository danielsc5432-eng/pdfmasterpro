import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundPlus, ShieldCheck } from "lucide-react";
export const metadata: Metadata = { title: "Criar conta", description: "Crie sua conta PDF Master Pro." };
export default function SignUpPage() { return <div className="page-shell"><div className="empty-panel auth-panel"><div className="tool-card-icon" style={{ margin: "0 auto" }}><UserRoundPlus size={22} /></div><h1>Criar sua conta</h1><p>O primeiro acesso com sua conta Manus cria automaticamente seu perfil no PDF Master Pro, sem senha separada para guardar.</p><a className="button button-primary" href="/api/auth/login?mode=signup">Criar conta com Manus</a><div className="auth-note"><ShieldCheck size={16} /><span>Você poderá excluir seu perfil e seus metadados pelo suporte da aplicação.</span></div><p className="auth-switch">Já tem conta? <Link href="/entrar">Entrar</Link></p></div></div>; }
