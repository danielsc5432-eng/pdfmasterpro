import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";

type TaskStatus = "processing" | "completed" | "failed";
type TaskRow = RowDataPacket & { id: string; tool_slug: string; status: TaskStatus; file_count: number; input_bytes: number; output_bytes: number | null; output_type: string | null; error_code: string | null; created_at: Date; completed_at: Date | null; expires_at: Date | null };

export function sessionHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function getSessionContext(request: NextRequest) { const existing = request.cookies.get("pdfmaster_session")?.value; const token = existing && /^[a-f0-9]{64}$/i.test(existing) ? existing : randomBytes(32).toString("hex"); return { token, hash: sessionHash(token), isNew: !existing }; }
export function attachSessionCookie<T extends NextResponse>(response: T, token: string, request: NextRequest) { const isPublicHttps = request.headers.get("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production"; response.cookies.set("pdfmaster_session", token, { httpOnly: true, sameSite: isPublicHttps ? "none" : "lax", secure: isPublicHttps, maxAge: 60 * 60 * 24 * 30, path: "/" }); return response; }

export async function createProcessingTask(input: { sessionHash: string; toolSlug: string; fileCount: number; inputBytes: number }) {
  const id = randomUUID();
  await getDb().execute("INSERT INTO processing_tasks (id, session_hash, tool_slug, status, file_count, input_bytes, expires_at) VALUES (?, ?, ?, 'processing', ?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 2 HOUR))", [id, input.sessionHash, input.toolSlug, input.fileCount, input.inputBytes]);
  return id;
}
export async function markProcessingTaskCompleted(id: string, outputBytes: number, outputType: string) { await getDb().execute("UPDATE processing_tasks SET status = 'completed', output_bytes = ?, output_type = ?, completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [outputBytes, outputType, id]); }
export async function markProcessingTaskFailed(id: string, errorCode: string) { await getDb().execute("UPDATE processing_tasks SET status = 'failed', error_code = ?, completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [errorCode.slice(0, 80), id]); }

export async function listProcessingTasks(hash: string) {
  const [rows] = await getDb().execute<TaskRow[]>("SELECT id, tool_slug, status, file_count, input_bytes, output_bytes, output_type, error_code, created_at, completed_at, expires_at FROM processing_tasks WHERE session_hash = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(3)) ORDER BY created_at DESC LIMIT 50", [hash]);
  return rows;
}
