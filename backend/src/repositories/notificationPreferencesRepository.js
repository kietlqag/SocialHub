import { query } from "../db.js";

export async function getUserPrefs(userId) {
  if (!userId) throw new Error("userId required");
  const sql = `SELECT popup_enabled, updated_at FROM notification_user_prefs WHERE user_id = $1`;
  const { rows } = await query(sql, [userId]);
  if (!rows.length) {
    return { popup_enabled: true };
  }
  return rows[0];
}

export async function upsertUserPrefs(userId, { popupEnabled }) {
  if (!userId) throw new Error("userId required");
  const sql = `
    INSERT INTO notification_user_prefs (user_id, popup_enabled)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET popup_enabled = EXCLUDED.popup_enabled, updated_at = NOW()
    RETURNING popup_enabled, updated_at
  `;
  const { rows } = await query(sql, [userId, popupEnabled]);
  return rows[0];
}
