import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CreditCard, LogOut, UserRound } from "lucide-react";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";
import { entitlementsForOpenId, latestSubscriptionForOpenId } from "@/lib/billing/entitlements";
import { formatFileSize } from "@/lib/plans";

export const metadata: Metadata = { title: "Painel", description: "Seu espaço de trabalho PDF Master Pro." };

export default async function DashboardPage() {
  const jar = await cookies();
  const user = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!user) return <div className="page-shell"><div className="page-header"><span className="eyebrow"><span className="eyebrow-dot" /> Área da conta</span><h1>Entre para acessar seu painel.</h1><p>Consulte seu histórico e preferências em um espaço protegido.</p><Link className="button button-primary" href="/entrar">Entrar com Manus</Link></div></div>;

  const { plan } = await entitlementsForOpenId(user.openId);
  const subscription = await latestSubscriptionForOpenId(user.openId);
  const premium = plan.id !== "free";
  const planLabel = plan.interval === "year" ? "Premium anual" : plan.interval === "month" ? "Premium mensal" : "Grátis";
  const until = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR") : null;

  return <div className="page-shell"><div className="page-header"><span className="eyebrow"><span className="eyebrow-dot" /> Área da conta</span><h1>Olá, {user.name}.</h1><p>Seu perfil está conectado e pronto para acompanhar suas tarefas PDF.</p></div><div className="feature-band" style={{ marginTop: 32 }}>
    <div className="feature-card"><UserRound size={19} /><h3>Perfil conectado</h3><p>{user.email}</p></div>
    <div className="feature-card"><CreditCard size={19} /><h3>{planLabel}</h3><p>{premium ? `Arquivos de até ${formatFileSize(plan.limits.maxFileBytes)}, sem anúncios${until ? `, ativo até ${until}` : ""}.` : `Até ${formatFileSize(plan.limits.maxFileBytes)} por arquivo e ${plan.limits.tasksPerDay} tarefas por dia.`}</p>{premium ? <Link className="text-link" href="/configuracoes">Gerenciar assinatura</Link> : <Link className="text-link" href="/precos">Ver planos Premium</Link>}</div><div className="feature-card"><h3>Histórico</h3><p>Veja as tarefas desta sessão em um só lugar.</p><Link className="text-link" href="/historico">Abrir histórico</Link></div><div className="feature-card"><h3>Sessão</h3><p>Você pode sair com segurança a qualquer momento.</p><a className="text-link" href="/api/auth/logout"><LogOut size={14} /> Sair</a></div></div></div>;
}
