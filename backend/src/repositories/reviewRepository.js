import { query } from "../db.js";

export async function listApprovedReviews(limit = 6) {
  const res = await query(
    `SELECT id,
            user_id AS "userId",
            name,
            email,
            rating,
            message,
            source,
            created_at AS "createdAt"
     FROM system_reviews
     WHERE status = 'approved'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows || [];
}

export async function getApprovedReviewStats() {
  const res = await query(
    `SELECT COALESCE(AVG(rating), 0)::float AS avg_rating,
            COUNT(*)::int AS total
     FROM system_reviews
     WHERE status = 'approved'`,
  );
  return res.rows[0] || { avg_rating: 0, total: 0 };
}

export async function findRecentSubmission({ email, ipHash }) {
  const params = [];
  const clauses = [];
  let idx = 1;
  if (email) {
    clauses.push(`email = $${idx++}`);
    params.push(email);
  }
  if (ipHash) {
    clauses.push(`ip_hash = $${idx++}`);
    params.push(ipHash);
  }
  if (!clauses.length) return null;
  const res = await query(
    `SELECT id
     FROM system_reviews
     WHERE created_at > NOW() - INTERVAL '30 seconds'
       AND (${clauses.join(" OR ")})
     LIMIT 1`,
    params,
  );
  return res.rows[0] || null;
}

export async function findReviewByUserId(userId) {
  if (!userId) return null;
  const res = await query(
    `SELECT id
     FROM system_reviews
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  return res.rows[0] || null;
}

export async function getReviewByUserId(userId) {
  if (!userId) return null;
  const res = await query(
    `SELECT id,
            user_id AS "userId",
            name,
            email,
            rating,
            message,
            source,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
     FROM system_reviews
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return res.rows[0] || null;
}

export async function insertReview(payload) {
  const res = await query(
    `INSERT INTO system_reviews
      (user_id, name, email, rating, message, source, status, ip_hash, user_agent)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id,
               user_id AS "userId",
               name,
               email,
               rating,
               message,
               source,
               status,
               created_at AS "createdAt"`,
    [
      payload.userId || null,
      payload.name || null,
      payload.email || null,
      payload.rating,
      payload.message,
      payload.source || "contact_page",
      payload.status || "pending",
      payload.ipHash || null,
      payload.userAgent || null,
    ],
  );
  return res.rows[0];
}

export async function updateReviewStatus(id, status) {
  const res = await query(
    `UPDATE system_reviews
     SET status = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, updated_at AS "updatedAt"`,
    [id, status],
  );
  return res.rows[0] || null;
}

export async function updateReviewById(id, userId, payload) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (typeof payload.rating !== "undefined") {
    fields.push(`rating = $${idx++}`);
    values.push(payload.rating);
  }
  if (typeof payload.message !== "undefined") {
    fields.push(`message = $${idx++}`);
    values.push(payload.message);
  }
  if (fields.length === 0) return null;
  fields.push(`updated_at = NOW()`);
  const res = await query(
    `UPDATE system_reviews
     SET ${fields.join(", ")}
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING id,
               user_id AS "userId",
               name,
               email,
               rating,
               message,
               source,
               status,
               created_at AS "createdAt",
               updated_at AS "updatedAt"`,
    [...values, id, userId],
  );
  return res.rows[0] || null;
}
