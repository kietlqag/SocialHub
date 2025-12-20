import { verifyJwt } from "../services/tokenService.js";

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role || "user" };
    return next();
  } catch (err) {
    console.error("Token verification failed", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};
