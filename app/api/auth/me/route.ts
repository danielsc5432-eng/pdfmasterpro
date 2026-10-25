import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { preferredName } from "@/lib/account/profile";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { const user = getCurrentUser(request); const headers = { "Cache-Control": "private, no-store" }; return user ? NextResponse.json({ authenticated: true, user: { name: await preferredName(user), email: user.email } }, { headers }) : NextResponse.json({ authenticated: false }, { status: 401, headers }); }
