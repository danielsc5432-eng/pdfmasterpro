import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
export const runtime = "nodejs";
export function GET(request: NextRequest) { const user = getCurrentUser(request); return user ? NextResponse.json({ authenticated: true, user: { name: user.name, email: user.email } }) : NextResponse.json({ authenticated: false }, { status: 401 }); }
