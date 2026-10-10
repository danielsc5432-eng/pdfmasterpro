import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, closeDb } from "@/lib/db";

export async function runMigrations() {
  const db = getDb();
  await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(191) NOT NULL PRIMARY KEY, applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  const directory = path.join(process.cwd(), "db/migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const [existing] = await db.execute("SELECT version FROM schema_migrations WHERE version = ? LIMIT 1", [version]);
    if (Array.isArray(existing) && existing.length) continue;
    const sql = await readFile(path.join(directory, file), "utf8");
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of sql.split(/;\s*(?:\n|$)/).map((part) => part.trim()).filter(Boolean)) await connection.query(statement);
      await connection.execute("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
      await connection.commit();
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
}
