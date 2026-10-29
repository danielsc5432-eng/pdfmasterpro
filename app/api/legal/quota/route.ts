import { createLocalQuotaHandler } from "@/lib/clonemaster/quota";
export const runtime = "nodejs";
export const POST = createLocalQuotaHandler("Arquivelio Jurídico");
