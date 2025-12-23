import { query } from "../db.js";

export async function getUnreadCount(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const sql = `SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND is_read = false`;
  const { rows } = await query(sql, [userId]);
  res.json({ unreadCount: rows[0]?.unread_count ?? 0 });
}
