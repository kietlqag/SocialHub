import { query } from "../db.js";

export async function insertResetToken(userId, tokenHash, expiresAt) {
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function getLatestResetToken(userId) {
  const res = await query(
    `SELECT id, token_hash, expires_at, used_at
     FROM password_reset_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return res.rows[0] || null;
}

export async function markResetTokenUsed(tokenId) {
  await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
}

export async function insertVerificationToken(userId, tokenHash, expiresAt) {
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function getLatestVerificationToken(userId) {
  const res = await query(
    `SELECT id, token_hash, expires_at, used_at
     FROM email_verification_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return res.rows[0] || null;
}

export async function markVerificationTokenUsed(tokenId) {
  await query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
}
