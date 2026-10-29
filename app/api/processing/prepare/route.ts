import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth/session";
import { getTool } from "@/lib/tools/catalog";
import { useDirectProcessing } from "@/lib/processing/fast-local";

export const runtime = "nodejs";
export const maxDuration = 90;
let warming: { origin: string; promise: Promise<void>; readyUntil: number } | undefined;
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/** User-triggered only. No document, account details, cookies or AI request are forwarded. */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(getPublicOrigin(request)).origin) return json({ ready: false }, 403);
  let input;
  try {
    const text = await request.text();
    if (text.length > 1024) return json({ ready: false }, 413);
    input = JSON.parse(text);
    if (typeof input.tool !== "string" || !getTool(input.tool) || !Number.isSafeInteger(input.bytes) || input.bytes <= 0 || input.bytes > 130 * 1024 * 1024) return json({ ready: false }, 400);
  } catch { return json({ ready: false }, 400); }
  if (useDirectProcessing(input.tool, input.bytes + 16384)) return json({ ready: true });
  const configured = process.env.PROCESSING_WORKER_URL?.trim();
  if (!configured || process.env.PROCESSING_WORKER_ONLY === "1") return json({ ready: true });
  try {
    const target = new URL(configured);
    if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash) return json({ ready: false }, 503);
    const origin = target.origin;
    if (warming?.origin === origin && warming.readyUntil > Date.now()) return json({ ready: true });
    if (!warming || warming.origin !== origin || warming.readyUntil !== 0) {
      const state = { origin, readyUntil: 0, promise: Promise.resolve() };
      state.promise = (async () => {
        const response = await fetch(`${origin}/api/health`, { redirect: "error", signal: AbortSignal.timeout(75000), cache: "no-store" });
        if (!response.ok) throw new Error("Processor unavailable");
        const body = await response.json();
        if (body.ok !== true) throw new Error("Processor not ready");
        state.readyUntil = Date.now() + 45000;
      })().catch(error => { if (warming === state) warming = undefined; throw error; });
      warming = state;
    }
    await warming.promise;
    return json({ ready: true });
  } catch { return json({ ready: false }, 503); }
}
