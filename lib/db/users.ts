import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";

export type AppUser = { openId: string; email: string; name: string };
type UserRow = RowDataPacket & { open_id: string; email: string; display_name: string };

export async function upsertUser(user: AppUser) {
  await getDb().execute("INSERT INTO users (open_id, email, display_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name), last_login_at = CURRENT_TIMESTAMP(3)", [user.openId, user.email.slice(0, 320), user.name.slice(0, 191)]);
  return user;
}
export async function findUser(openId: string) {
  const [rows] = await getDb().execute<UserRow[]>("SELECT open_id, email, display_name FROM users WHERE open_id = ? LIMIT 1", [openId]);
  const row = rows[0];
  return row ? { openId: row.open_id, email: row.email, name: row.display_name } : null;
}
