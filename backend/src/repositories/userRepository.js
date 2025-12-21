import { query } from "../db.js";

const baseSelect =
  `SELECT id,
          email,
          password_hash,
          full_name AS "fullName",
          company,
          created_at AS "createdAt",
          is_verified AS "isVerified",
          provider,
          provider_id AS "providerId",
          avatar_url AS "avatarUrl"
   FROM users`;

export async function insertUser({ email, passwordHash, fullName, company }) {
  const res = await query(
    `INSERT INTO users (email, password_hash, full_name, company, is_verified, provider, provider_id, avatar_url)
     VALUES ($1, $2, $3, $4, false, NULL, NULL, NULL)
     RETURNING id,
               email,
               full_name AS "fullName",
               company,
               created_at AS "createdAt",
               is_verified AS "isVerified",
               provider,
               provider_id AS "providerId",
               avatar_url AS "avatarUrl"`,
    [email, passwordHash, fullName || null, company || null]
  );
  return res.rows[0];
}

export async function findUserByEmail(email) {
  const res = await query(`${baseSelect} WHERE email = $1`, [email]);
  return res.rows[0] || null;
}

export async function updatePasswordHash(userId, passwordHash) {
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    passwordHash,
    userId,
  ]);
}

export async function markVerified(userId) {
  await query(`UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
}

export async function selectUserById(userId) {
  const res = await query(
    `${baseSelect}
     WHERE id = $1`,
    [userId]
  );
  return res.rows[0] || null;
}

export async function searchUsers(term) {
  const like = `%${term}%`;
  const res = await query(
    `${baseSelect}
     WHERE email ILIKE $1 OR full_name ILIKE $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [like]
  );
  return res.rows || [];
}

export async function updateOAuthProfile(userId, { provider, providerId, avatarUrl }) {
  await query(
    `UPDATE users
     SET provider = $1,
         provider_id = $2,
         avatar_url = $3,
         is_verified = true,
         updated_at = NOW()
     WHERE id = $4`,
    [provider, providerId || null, avatarUrl || null, userId]
  );
}

export async function selectUsersByIds(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const res = await query(
    `${baseSelect}
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return res.rows || [];
}
