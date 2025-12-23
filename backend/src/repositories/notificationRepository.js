import { query } from "../db.js";

const normalizeSort = (sort) => {
  if (sort === "oldest") return "ORDER BY created_at ASC";
  if (sort === "unread") return "ORDER BY is_read ASC, created_at DESC";
  return "ORDER BY created_at DESC";
};

const buildFilters = ({ userId, tab = "all", q }) => {
  const clauses = ["user_id = $1"];
  const params = [userId];
  let idx = params.length + 1;

  if (tab === "unread") {
    clauses.push("is_read = false");
  } else if (tab === "starred") {
    clauses.push("is_starred = true");
  }

  if (q) {
    clauses.push(`(title ILIKE $${idx} OR message ILIKE $${idx} OR metadata::text ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx += 1;
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params };
};

export async function listNotifications({ userId, tab = "all", q, sort = "newest", limit = 50, offset = 0 } = {}) {
  if (!userId) throw new Error("userId is required to list notifications");
  const { where, params } = buildFilters({ userId, tab, q });
  const orderBy = normalizeSort(sort);
  const sql = `SELECT id, title, message, type, metadata, is_read as read, is_starred, user_id, created_at, updated_at FROM notifications ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await query(sql, [...params, limit, offset]);
  return rows.map((r) => ({ ...r, id: String(r.id) }));
}

export async function countNotifications({ userId, tab = "all", q }) {
  if (!userId) throw new Error("userId is required to count notifications");
  const { where, params } = buildFilters({ userId, tab, q });
  const sql = `SELECT COUNT(*)::int AS total FROM notifications ${where}`;
  const { rows } = await query(sql, params);
  return rows[0]?.total ?? 0;
}

export async function getCategoryCounts({ userId }) {
  if (!userId) throw new Error("userId is required to count notifications");
  const where = `WHERE user_id = $1`;
  const params = [userId];
  const sql = `
    SELECT
      COUNT(*)::int AS all_count,
      SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END)::int AS unread_count,
      SUM(CASE WHEN is_starred = true THEN 1 ELSE 0 END)::int AS starred_count
    FROM notifications
    ${where}
  `;
  const { rows } = await query(sql, params);
  const row = rows[0] || { all_count: 0, unread_count: 0, starred_count: 0 };
  return { all: row.all_count, unread: row.unread_count, starred: row.starred_count };
}

export async function createNotification(payload) {
  const userId = payload.user_id || payload.userId;
  if (!userId) throw new Error("user_id is required for notification");
  const sql = `INSERT INTO notifications (user_id, title, message, type, metadata, is_read, is_starred) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, title, message, type, metadata, is_read as read, is_starred, user_id, created_at, updated_at`;
  const params = [
    userId,
    payload.title || "",
    payload.message || "",
    payload.type || "info",
    payload.metadata || {},
    payload.read || false,
    payload.is_starred || payload.starred || false,
  ];
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
  if (typeof update.is_starred !== "undefined" || typeof update.starred !== "undefined") {
    fields.push(`is_starred = $${idx++}`);
    values.push(typeof update.is_starred !== "undefined" ? update.is_starred : update.starred);
  }
  if (fields.length === 0) throw new Error("No update fields provided");
  fields.push(`updated_at = NOW()`);
  const sql = `UPDATE notifications SET ${fields.join(", ")} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING id, title, message, type, metadata, is_read as read, is_starred, user_id, created_at, updated_at`;
  values.push(id, userId);
  const { rows } = await query(sql, values);
  return rows[0];
}
// (removed legacy Mongo update implementation)
