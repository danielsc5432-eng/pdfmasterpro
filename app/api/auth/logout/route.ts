import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin, SESSION_COOKIE } from "@/lib/auth/session";
export const runtime = "nodejs";
export function GET(request: NextRequest) { const response = NextResponse.redirect(new URL("/", getPublicOrigin(request))); response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "none", secure: true, maxAge: 0, path: "/" }); response.cookies.set("pdfmaster_session", "", { httpOnly: true, sameSite: "none", secure: true, maxAge: 0, path: "/" }); return response; }
