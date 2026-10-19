import { query } from "@/lib/db";

export type AppUser = { openId: string; email: string; name: string };
type UserRow = { open_id: string; email: string; display_name: string };

export async function upsertUser(user: AppUser) {
  await query("INSERT INTO users (open_id, email, display_name) VALUES (?, ?, ?) ON CONFLICT (open_id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, last_login_at = CURRENT_TIMESTAMP", [user.openId, user.email.slice(0, 320), user.name.slice(0, 191)]);
  return user;
}
export async function findUser(openId: string) {
  const rows = await query<UserRow>("SELECT open_id, email, display_name FROM users WHERE open_id = ? LIMIT 1", [openId]);
  const row = rows[0];
  return row ? { openId: row.open_id, email: row.email, name: row.display_name } : null;
}
