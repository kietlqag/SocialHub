import { searchUsers as searchUsersRepo } from "../repositories/userRepository.js";

export async function searchUsers(req, res) {
  const query = (req.query.query || req.query.q || "").toString().trim();
  if (!query) {
    return res.json({ users: [] });
  }
  const users = await searchUsersRepo(query);
  return res.json({
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName || u.email,
      email: u.email,
    })),
  });
}
