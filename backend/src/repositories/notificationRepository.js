import { query } from "../db.js";

// Postgres-backed notifications repository
export async function listNotifications({ userId, limit = 100, offset = 0, unreadOnly = false } = {}) {
  if (!userId) throw new Error("userId is required to list notifications");
  const whereParts = ["user_id = $1"];
  if (unreadOnly) whereParts.push("is_read = false");
  const where = `WHERE ${whereParts.join(" AND ")}`;
  const sql = `SELECT id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at FROM notifications ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
  const { rows } = await query(sql, [userId, limit, offset]);
  return rows.map((r) => ({ ...r, id: String(r.id) }));
}

export async function createNotification(payload) {
  const userId = payload.user_id || payload.userId;
  if (!userId) throw new Error("user_id is required for notification");
  const sql = `INSERT INTO notifications (user_id, title, message, type, metadata, is_read) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at`;
  const params = [userId, payload.title || "", payload.message || "", payload.type || "info", payload.metadata || {}, payload.read || false];
  const { rows } = await query(sql, params);
  return rows[0];
}

export async function removeNotification(id, userId) {
  if (!userId) throw new Error("userId is required to delete notification");
  const sql = `DELETE FROM notifications WHERE id = $1 AND user_id = $2`;
  const { rowCount } = await query(sql, [id, userId]);
  return rowCount > 0;
}

export async function updateNotification(id, update, userId) {
  if (!userId) throw new Error("userId is required to update notification");
  const fields = [];
  const values = [];
  let idx = 1;
  if (typeof update.title !== "undefined") { fields.push(`title = $${idx++}`); values.push(update.title); }
  if (typeof update.message !== "undefined") { fields.push(`message = $${idx++}`); values.push(update.message); }
  if (typeof update.type !== "undefined") { fields.push(`type = $${idx++}`); values.push(update.type); }
  if (typeof update.metadata !== "undefined") { fields.push(`metadata = $${idx++}`); values.push(update.metadata); }
  if (typeof update.read !== "undefined") { fields.push(`is_read = $${idx++}`); values.push(update.read); }
  if (fields.length === 0) throw new Error("No update fields provided");
  fields.push(`updated_at = NOW()`);
  const sql = `UPDATE notifications SET ${fields.join(", ")} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at`;
  values.push(id, userId);
  const { rows } = await query(sql, values);
  return rows[0];
}
// (removed legacy Mongo update implementation)
