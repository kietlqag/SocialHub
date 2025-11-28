import { query } from "../db.js";

// Postgres-backed notifications repository
export async function listNotifications({ limit = 100, unreadOnly = false } = {}) {
  const where = unreadOnly ? "WHERE is_read = false" : "";
  const sql = `SELECT id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at FROM notifications ${where} ORDER BY created_at DESC LIMIT $1`;
  const { rows } = await query(sql, [limit]);
  return rows.map((r) => ({ ...r, id: String(r.id) }));
}

export async function createNotification(payload) {
  const sql = `INSERT INTO notifications (title, message, type, metadata, is_read, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at`;
  const params = [payload.title || null, payload.message || null, payload.type || 'info', payload.metadata || {}, payload.read || false, payload.user_id || null];
  const { rows } = await query(sql, params);
  return rows[0];
}

export async function removeNotification(id) {
  const sql = `DELETE FROM notifications WHERE id = $1`;
  return query(sql, [id]);
}

export async function updateNotification(id, update) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (typeof update.title !== 'undefined') { fields.push(`title = $${idx++}`); values.push(update.title); }
  if (typeof update.message !== 'undefined') { fields.push(`message = $${idx++}`); values.push(update.message); }
  if (typeof update.type !== 'undefined') { fields.push(`type = $${idx++}`); values.push(update.type); }
  if (typeof update.metadata !== 'undefined') { fields.push(`metadata = $${idx++}`); values.push(update.metadata); }
  if (typeof update.read !== 'undefined') { fields.push(`is_read = $${idx++}`); values.push(update.read); }
  if (fields.length === 0) throw new Error('No update fields provided');
  fields.push(`updated_at = NOW()`);
  const sql = `UPDATE notifications SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, message, type, metadata, is_read as read, user_id, created_at, updated_at`;
  values.push(id);
  const { rows } = await query(sql, values);
  return rows[0];
}
// (removed legacy Mongo update implementation)
