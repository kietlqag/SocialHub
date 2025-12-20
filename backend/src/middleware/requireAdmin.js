export const requireAdmin = (req, res, next) => {
  // authenticate middleware phải chạy trước để gắn req.user
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
};
