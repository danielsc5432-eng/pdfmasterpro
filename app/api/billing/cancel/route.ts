import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelPreapproval, mercadopagoConfigured } from "@/lib/billing/mercadopago";
import { cancelActiveSubscription, getActiveSubscription } from "@/lib/db/subscriptions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Entre na sua conta para gerenciar a assinatura." }, { status: 401 });

  const active = await getActiveSubscription(user.openId);
  if (!active) return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });

  if (active.provider === "mercadopago-checkout") {
    // Compra avulsa já paga: não há recorrência a cancelar no Mercado Pago.
    // O acesso segue até o fim do período e simplesmente não renova.
    await cancelActiveSubscription(user.openId);
    return NextResponse.json({ ok: true, recurring: false });
  }

  if (active.providerSubscriptionId && mercadopagoConfigured()) {
    try {
      await cancelPreapproval(active.providerSubscriptionId);
    } catch (error) {
      console.warn("[pdfmaster] cancelamento no Mercado Pago:", error instanceof Error ? error.message : error);
    }
  }

  await cancelActiveSubscription(user.openId);
  return NextResponse.json({ ok: true });
}
