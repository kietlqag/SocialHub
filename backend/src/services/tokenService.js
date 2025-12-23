import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const TOKEN_TTL = "1d";

export function issueJwt(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role || "user" }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}
