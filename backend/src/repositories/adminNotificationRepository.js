import { query } from "../db.js";

export async function listAdminNotifications({ limit = 200, unreadOnly = false } = {}) {
  const where = unreadOnly ? "WHERE is_read = false" : "";
  const res = await query(
    `SELECT n.id,
            n.title,
            n.message,
            n.type,
            n.metadata,
            n.is_read AS read,
            n.is_starred AS "isStarred",
            n.user_id AS "userId",
            n.created_at AS "createdAt",
            n.updated_at AS "updatedAt",
            u.email AS "userEmail",
            u.full_name AS "userName"
     FROM notifications n
     LEFT JOIN users u ON n.user_id = u.id
     ${where}
     ORDER BY n.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({ ...r, id: String(r.id) }));
}

export async function createAdminNotification({ title, message, type = "info", metadata = {}, userId, read = false }) {
  const res = await query(
    `INSERT INTO notifications (title, message, type, metadata, is_read, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
               title,
               message,
               type,
               metadata,
               is_read AS read,
               is_starred AS "isStarred",
               user_id AS "userId",
               created_at AS "createdAt",
               updated_at AS "updatedAt"`,
    [title, message, type, metadata, read, userId]
  );
  return res.rows[0];
}

export async function updateAdminNotification(id, { title, message, type, metadata, read }) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (typeof title !== "undefined") {
    fields.push(`title = $${idx++}`);
    values.push(title);
  }
  if (typeof message !== "undefined") {
    fields.push(`message = $${idx++}`);
    values.push(message);
  }
  if (typeof type !== "undefined") {
    fields.push(`type = $${idx++}`);
    values.push(type);
  }
  if (typeof metadata !== "undefined") {
    fields.push(`metadata = $${idx++}`);
    values.push(metadata);
  }
  if (typeof read !== "undefined") {
    fields.push(`is_read = $${idx++}`);
    values.push(read);
  }
  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);
  const res = await query(
    `UPDATE notifications
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id,
               title,
               message,
               type,
               metadata,
               is_read AS read,
               is_starred AS "isStarred",
               user_id AS "userId",
               created_at AS "createdAt",
               updated_at AS "updatedAt"`,
    [...values, id]
  );
  return res.rows[0] || null;
}

export async function deleteAdminNotification(id) {
  const res = await query(`DELETE FROM notifications WHERE id = $1`, [id]);
  return res.rowCount > 0;
}
