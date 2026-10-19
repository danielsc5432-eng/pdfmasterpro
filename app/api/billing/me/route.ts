import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { entitlementsForOpenId, latestSubscriptionForOpenId } from "@/lib/billing/entitlements";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  const { plan } = await entitlementsForOpenId(user?.openId);
  const subscription = await latestSubscriptionForOpenId(user?.openId);

  return NextResponse.json({
    authenticated: Boolean(user),
    planId: plan.id,
    interval: plan.interval,
    priceCents: plan.priceCents,
    limits: {
      maxFileBytes: plan.limits.maxFileBytes,
      maxFilesPerTask: plan.limits.maxFilesPerTask,
      tasksPerDay: Number.isFinite(plan.limits.tasksPerDay) ? plan.limits.tasksPerDay : null,
      premiumTools: plan.limits.premiumTools,
      removeAds: plan.limits.removeAds,
    },
    subscription: subscription ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd, cancelledAt: subscription.cancelledAt } : null,
    paymentReady: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
  });
}
