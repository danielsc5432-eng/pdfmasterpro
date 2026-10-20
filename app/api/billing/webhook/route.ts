import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedPayment, getPayment, getPreapproval, mapPreapprovalStatus, mercadopagoConfigured, verifyWebhookSignature } from "@/lib/billing/mercadopago";
import { createSubscription, findSubscriptionByProviderId, recordBillingEvent, updateSubscription, type Subscription } from "@/lib/db/subscriptions";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * Sincroniza uma compra avulsa (Checkout Pro).
 *
 * O `external_reference` é o openId do comprador. Ao aprovar, a assinatura
 * registrada no checkout é autorizada com validade de um mês ou de um ano.
 */
async function syncPayment(paymentId: string) {
  const payment = await getPayment(paymentId);
  const openId = payment.external_reference;
  if (!openId) return null;

  let record: Subscription | null = await findSubscriptionByProviderId("mercadopago-checkout", paymentId);

  if (!record) {
    // O webhook pode chegar pelo id do pagamento, sem a preferência associada:
    // procura a assinatura pendente mais recente desse usuário.
    const { getLatestSubscription } = await import("@/lib/db/subscriptions");
    const latest = await getLatestSubscription(openId);
    if (latest && latest.provider === "mercadopago-checkout" && latest.status === "pending") record = latest;
  }

  if (!record) {
    const plan = getPlan(payment.transaction_amount === 149.9 ? "premium-annual" : "premium-monthly");
    await createSubscription({
      openId,
      planId: plan.id,
      provider: "mercadopago-checkout",
      providerSubscriptionId: paymentId,
      payerEmail: payment.payer?.email ?? null,
      amountCents: Math.round((payment.transaction_amount ?? plan.priceCents / 100) * 100),
      frequency: plan.interval === "year" ? 12 : 1,
      frequencyType: "months",
    });
    record = await findSubscriptionByProviderId("mercadopago-checkout", paymentId);
  }

  if (!record) return null;

  if (payment.status === "approved") {
    const months = record.frequencyType === "months" ? record.frequency : 1;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + months);
    await updateSubscription(record.id, {
      status: "authorized",
      startedAt: record.startedAt ?? new Date(),
      currentPeriodEnd: periodEnd,
      providerSubscriptionId: paymentId,
    });
    return "authorized";
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await updateSubscription(record.id, { status: payment.status === "rejected" ? "rejected" : "cancelled", cancelledAt: new Date() });
    return payment.status;
  }

  return "pending";
}

async function syncPreapproval(preapprovalId: string) {
  const preapproval = await getPreapproval(preapprovalId);
  let record: Subscription | null = await findSubscriptionByProviderId("mercadopago", preapprovalId);

  if (!record && preapproval.external_reference) {
    const annual = preapproval.auto_recurring?.frequency === 12;
    const plan = getPlan(annual ? "premium-annual" : "premium-monthly");
    const amount = Math.round((preapproval.auto_recurring?.transaction_amount ?? plan.priceCents / 100) * 100);
    await createSubscription({
      openId: preapproval.external_reference,
      planId: plan.id,
      provider: "mercadopago",
      providerSubscriptionId: preapproval.id ?? preapprovalId,
      payerEmail: preapproval.payer_email ?? null,
      amountCents: amount,
      frequency: preapproval.auto_recurring?.frequency ?? (annual ? 12 : 1),
      frequencyType: preapproval.auto_recurring?.frequency_type ?? "months",
    });
    record = await findSubscriptionByProviderId("mercadopago", preapprovalId);
  }

  if (!record) return null;
  const status = mapPreapprovalStatus(preapproval.status);
  const nextPayment = preapproval.auto_recurring?.next_payment_date;
  const periodEnd = nextPayment ? new Date(nextPayment) : record.currentPeriodEnd;
  const revoked = status === "cancelled" || status === "expired" || status === "rejected";
  await updateSubscription(record.id, {
    status,
    currentPeriodEnd: status === "authorized" ? periodEnd : record.currentPeriodEnd,
    startedAt: status === "authorized" ? record.startedAt ?? new Date() : record.startedAt,
    cancelledAt: revoked ? record.cancelledAt ?? new Date() : record.cancelledAt,
    providerSubscriptionId: preapproval.id ?? record.providerSubscriptionId,
  });
  return status;
}

export async function POST(request: NextRequest) {
  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const raw = await request.text();
  let payload: Record<string, unknown> | null = null;
  try { payload = raw ? JSON.parse(raw) as Record<string, unknown> : null; } catch { payload = null; }

  const params = request.nextUrl.searchParams;
  const dataFromBody = (payload?.data as Record<string, unknown> | undefined)?.id;
  const topic = String(params.get("type") || params.get("topic") || payload?.type || payload?.topic || "").trim();
  const resourceId = String(params.get("data.id") || params.get("id") || dataFromBody || "") || null;

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
  if (!verifyWebhookSignature({ signatureHeader, requestId, dataId: resourceId, secret })) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  await recordBillingEvent({ provider: "mercadopago", topic: topic || null, status: null, providerResourceId: resourceId, payload });

  if (!mercadopagoConfigured()) return NextResponse.json({ ok: true, skipped: "provider-not-configured" });

  try {
    if ((topic === "preapproval" || topic === "subscription_preapproval") && resourceId) {
      await syncPreapproval(resourceId);
    } else if ((topic === "authorized_payment" || topic === "subscription_authorized_payment") && resourceId) {
      const payment = await getAuthorizedPayment(resourceId);
      if (payment.preapproval_id) await syncPreapproval(payment.preapproval_id);
    } else if (topic === "payment" && resourceId) {
      await syncPayment(resourceId);
    }
  } catch (error) {
    // Sempre respondemos 200 para o Mercado Pago não entrar em ciclo de reenvios.
    console.warn("[pdfmaster] webhook do Mercado Pago:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true });
}
