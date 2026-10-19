import { NextResponse } from "next/server";
import { databaseConfigured, query } from "@/lib/db";

/**
 * Endpoint temporário de diagnóstico: confirma se as migrações foram aplicadas
 * no Postgres de produção e se um INSERT real funciona. Será removido após a
 * verificação.
 */
export async function GET() {
  if (!databaseConfigured()) return NextResponse.json({ configured: false });

  const report: Record<string, unknown> = { configured: true };
  try {
    const tables = await query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    report.tables = tables.map((t) => t.tablename);

    const applied = await query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
    report.migrations = applied.map((m) => m.version);
  } catch (error) {
    report.readError = error instanceof Error ? error.message : String(error);
  }

  try {
    const inserted = await query<{ id: string }>(
      "INSERT INTO processing_tasks (id, session_hash, tool_slug, status, file_count, input_bytes, expires_at) VALUES (gen_random_uuid(), ?, ?, 'processing', ?, ?, CURRENT_TIMESTAMP + INTERVAL '2 hours') RETURNING id",
      ["diag", "diagnostico", 1, 123],
    );
    report.insertOk = inserted.length === 1;
    await query("DELETE FROM processing_tasks WHERE session_hash = ?", ["diag"]);
  } catch (error) {
    report.insertError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(report);
}
