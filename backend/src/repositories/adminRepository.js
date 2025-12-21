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

export async function createUserAdmin({ email, passwordHash, fullName, company, role = "user", isVerified = false }) {
  const res = await query(
    `INSERT INTO users (email, password_hash, full_name, company, role, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
               email,
               role,
               full_name AS "name",
               company,
               is_verified AS "isVerified",
               created_at AS "joinDate",
               updated_at AS "updatedAt"`,
    [email, passwordHash, fullName || null, company || null, role, isVerified]
  );
  return res.rows[0];
}

export async function updateUserAdmin(id, { fullName, company, role, isVerified }) {
  const res = await query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         company = COALESCE($3, company),
         role = COALESCE($4, role),
         is_verified = COALESCE($5, is_verified),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id,
               email,
               role,
               full_name AS "name",
               company,
               is_verified AS "isVerified",
               created_at AS "joinDate",
               updated_at AS "updatedAt"`,
    [id, fullName, company, role, isVerified]
  );
  return res.rows[0] || null;
}

export async function deleteUserAdmin(id) {
  const res = await query(`DELETE FROM users WHERE id = $1`, [id]);
  return res.rowCount > 0;
}
