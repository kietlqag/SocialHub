import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const TOKEN_TTL = "1d";

const baseUserSelect =
  `SELECT id, email, password_hash, full_name AS "fullName", company, created_at AS "createdAt", is_verified AS "isVerified", provider, provider_id AS "providerId", avatar_url AS "avatarUrl"
   FROM users`;

export async function createUser({ email, password, fullName, company }) {
  const hash = await bcrypt.hash(password, 10);
  const res = await query(
    `INSERT INTO users (email, password_hash, full_name, company, is_verified, provider, provider_id, avatar_url)
     VALUES ($1, $2, $3, $4, false, NULL, NULL, NULL)
     RETURNING id, email, full_name AS "fullName", company, created_at AS "createdAt", is_verified AS "isVerified", provider, provider_id AS "providerId", avatar_url AS "avatarUrl"`,
    [email, hash, fullName || null, company || null]
  );
  return res.rows[0];
}

export async function findUserByEmail(email) {
  const res = await query(
    `${baseUserSelect} WHERE email = $1`,
    [email]
  );
  return res.rows[0] || null;
}

export async function issueJwt(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function createResetToken(userId) {
  const raw = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(raw, 10);
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expires]
  );
  return { code: raw, expiresAt: expires };
}

export async function consumeResetToken(email, code) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("User not found");
  const res = await query(
    `SELECT id, token_hash, expires_at, used_at
     FROM password_reset_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id]
  );
  const token = res.rows[0];
  if (!token) throw new Error("No reset token");
  if (token.used_at) throw new Error("Token already used");
  if (new Date(token.expires_at) < new Date()) throw new Error("Token expired");
  const ok = await bcrypt.compare(code, token.token_hash);
  if (!ok) throw new Error("Invalid code");
  await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [token.id]);
  return user;
}

export async function updatePassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    hash,
    userId,
  ]);
}

export async function createVerificationToken(userId) {
  const raw = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(raw, 10);
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expires]
  );
  return { code: raw, expiresAt: expires };
}

export async function verifyEmailToken(userId, code) {
  const errorWithStatus = (message, status = 400) =>
    Object.assign(new Error(message), { status });

  const res = await query(
    `SELECT id, token_hash, expires_at, used_at
     FROM email_verification_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const token = res.rows[0];
  if (!token) {
    throw errorWithStatus("Verification code not found.");
  }
  if (token.used_at) throw errorWithStatus("Verification code has already been used.");
  if (new Date(token.expires_at) < new Date()) throw errorWithStatus("Verification code has expired.");
  const ok = await bcrypt.compare(code, token.token_hash);
  if (!ok) throw errorWithStatus("Verification code is incorrect.");
  await query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [token.id]);
}

export async function markUserVerified(userId) {
  await query(`UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
}

export async function ensureOAuthUser({ email, fullName, provider, providerId, avatarUrl }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (!existing.isVerified) {
      await markUserVerified(existing.id);
    }
    return existing;
  }
  const randomPassword = crypto.randomBytes(16).toString("hex");
  const hash = await bcrypt.hash(randomPassword, 10);
  const res = await query(
    `INSERT INTO users (email, password_hash, full_name, company, is_verified, provider, provider_id, avatar_url)
     VALUES ($1, $2, $3, NULL, true, $4, $5, $6)
     RETURNING id, email, full_name AS "fullName", company, created_at AS "createdAt", is_verified AS "isVerified", provider, provider_id AS "providerId", avatar_url AS "avatarUrl"`,
    [email, hash, fullName || email.split("@")[0], provider, providerId || null, avatarUrl || null]
  );
  return res.rows[0];
}
