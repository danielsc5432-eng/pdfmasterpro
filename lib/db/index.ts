import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | undefined;

export function getDb() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  pool = mysql.createPool({ uri: url, waitForConnections: true, connectionLimit: 5, queueLimit: 0, enableKeepAlive: true });
  return pool;
}

export async function closeDb() {
  if (pool) { await pool.end(); pool = undefined; }
}
