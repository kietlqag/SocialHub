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
