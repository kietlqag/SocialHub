import { query } from "../db.js";

export async function listUsers() {
  const res = await query(
    `SELECT id,
            email,
            role,
            full_name AS "name",
            company,
            is_verified AS "isVerified",
            created_at AS "joinDate",
            updated_at AS "updatedAt"
     FROM users
     ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getUsersByIds(ids = []) {
  if (!ids.length) return [];
  const res = await query(
    `SELECT id,
            email,
            role,
            full_name AS "name",
            company,
            is_verified AS "isVerified"
     FROM users
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return res.rows;
}
