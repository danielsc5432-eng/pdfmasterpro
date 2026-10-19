import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Diagnóstico temporário do primeiro checkout real.
 *
 * Exige o cabeçalho `x-diag-token` com o valor de DIAG_TOKEN (variável de
 * ambiente só de produção). Mostra o estado das assinaturas e os últimos
 * eventos de cobrança, sem expor e-mail nem identificadores completos.
 * Será removido assim que o ciclo estiver validado.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const expected = process.env.DIAG_TOKEN?.trim();
  if (!expected || request.headers.get("x-diag-token") !== expected) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const mask = (value: string | null) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : null);

  try {
    const subs = await query<{
      id: string; plan_id: string; status: string; amount_cents: number | string;
      provider_subscription_id: string | null; provider_payer_email: string | null;
      created_at: Date; started_at: Date | null; current_period_end: Date | null; cancelled_at: Date | null;
    }>(
      "SELECT id, plan_id, status, amount_cents, provider_subscription_id, provider_payer_email, created_at, started_at, current_period_end, cancelled_at FROM subscriptions ORDER BY created_at DESC LIMIT 8",
    );

    const events = await query<{ topic: string | null; provider_resource_id: string | null; created_at: Date }>(
      "SELECT topic, provider_resource_id, created_at FROM billing_events ORDER BY created_at DESC LIMIT 12",
    );

    return NextResponse.json({
      ok: true,
      subscriptions: subs.map((s) => ({
        id: mask(s.id),
        planId: s.plan_id,
        status: s.status,
        amountCents: Number(s.amount_cents),
        providerSubscriptionId: mask(s.provider_subscription_id),
        payer: mask(s.provider_payer_email),
        createdAt: s.created_at,
        startedAt: s.started_at,
        currentPeriodEnd: s.current_period_end,
        cancelledAt: s.cancelled_at,
      })),
      recentEvents: events.map((e) => ({ topic: e.topic, resource: mask(e.provider_resource_id), at: e.created_at })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
