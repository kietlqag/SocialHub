import { verifyJwt } from "../services/tokenService.js";

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role || "user" };
  } catch (err) {
    console.warn("Optional auth ignored invalid token", err?.message || err);
  }
  return next();
};
