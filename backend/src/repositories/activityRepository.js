import { query } from "../db.js";

export async function insertActivity({ userId, action, targetType, targetId, metadata = {} }) {
  const res = await query(
    `INSERT INTO activity_logs (user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id,
               user_id AS "userId",
               action,
               target_type AS "targetType",
               target_id AS "targetId",
               metadata,
               created_at AS "createdAt"`,
    [userId || null, action, targetType || null, targetId || null, metadata]
  );
  return res.rows[0];
}

export async function listActivities({ limit = 200 } = {}) {
  const res = await query(
    `SELECT id,
            user_id AS "userId",
            action,
            target_type AS "targetType",
            target_id AS "targetId",
            metadata,
            created_at AS "createdAt"
     FROM activity_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}
