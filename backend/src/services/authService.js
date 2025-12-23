import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  findUserByEmail,
  insertUser,
  markVerified,
  selectUserById,
  updatePasswordHash,
  updateOAuthProfile,
} from "../repositories/userRepository.js";
import {
  getLatestResetToken,
  getLatestVerificationToken,
  insertResetToken,
  insertVerificationToken,
  markResetTokenUsed,
  markVerificationTokenUsed,
} from "../repositories/tokenRepository.js";
import { issueJwt } from "./tokenService.js";
import { HttpError, withStatus } from "../utils/httpError.js";

const hashCode = (code) => bcrypt.hash(code, 10);

const randomCode = (digits = 6) => Math.floor(10 ** (digits - 1) + Math.random() * 9 * 10 ** (digits - 1)).toString();

export async function registerUser({ email, password, fullName, company }) {
  if (!email || !password) {
    throw new HttpError(400, "Email and password are required.");
  }
  if (password.length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.");
  }
  const exists = await findUserByEmail(email);
  if (exists) {
    throw new HttpError(409, "Email already exists.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await insertUser({ email, passwordHash, fullName, company });
  const verification = await createVerification(user.id);
  return { user, verification };
}

export async function loginUser(email, password) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new HttpError(401, "Invalid email or password.");
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new HttpError(401, "Invalid email or password.");
  }
  if (!user.isVerified) {
    throw new HttpError(403, "Account email is not verified.");
  }
  const token = await issueJwt(user);
  const { password_hash, ...clean } = user;
  return { user: clean, token };
}

export async function createVerification(userId) {
  const code = randomCode();
  const hash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await insertVerificationToken(userId, hash, expiresAt);
  return { code, expiresAt };
}

export async function verifyEmail(userId, code) {
  const token = await getLatestVerificationToken(userId);
  if (!token) {
    throw withStatus("Verification code not found.", 404);
  }
  if (token.used_at) throw withStatus("Verification code has already been used.");
  if (new Date(token.expires_at) < new Date()) throw withStatus("Verification code has expired.");
  const ok = await bcrypt.compare(code, token.token_hash);
  if (!ok) throw withStatus("Verification code is incorrect.");
  await markVerificationTokenUsed(token.id);
  await markVerified(userId);
}

export async function resendVerification(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (user.isVerified) {
    return { user, alreadyVerified: true };
  }
  const verification = await createVerification(user.id);
  return { user, verification };
}

export async function createPasswordReset(email) {
  const user = await findUserByEmail(email);
  if (!user) throw new HttpError(404, "Email does not exist");
  if (!user.isVerified) throw new HttpError(400, "Account email is not verified.");
  const code = randomCode();
  const hash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await insertResetToken(user.id, hash, expiresAt);
  return { user, code };
}

export async function resetPassword(email, code, newPassword) {
  const user = await findUserByEmail(email);
  if (!user) throw new HttpError(404, "User not found");
  if (!newPassword || newPassword.length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.");
  }
  const latestToken = await getLatestResetToken(user.id);
  if (!latestToken) throw new HttpError(400, "No reset token");
  if (latestToken.used_at) throw new HttpError(400, "Token already used");
  if (new Date(latestToken.expires_at) < new Date()) throw new HttpError(400, "Token expired");
  const ok = await bcrypt.compare(code, latestToken.token_hash);
  if (!ok) throw new HttpError(400, "Invalid code");
  await markResetTokenUsed(latestToken.id);
  const hash = await bcrypt.hash(newPassword, 10);
  await updatePasswordHash(user.id, hash);
}

export async function ensureOAuthUser({ email, fullName, provider, providerId, avatarUrl }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (!existing.isVerified) {
      await markVerified(existing.id);
    }
    return existing;
  }
  const randomPassword = crypto.randomBytes(16).toString("hex");
  const hash = await bcrypt.hash(randomPassword, 10);
  const user = await insertUser({
    email,
    passwordHash: hash,
    fullName: fullName || email.split("@")[0],
    company: null,
  });
  await updateOAuthProfile(user.id, { provider, providerId, avatarUrl });
  return { ...user, provider, providerId, avatarUrl, isVerified: true };
}

export async function getUserProfile(userId) {
  const user = await selectUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  return user;
}
