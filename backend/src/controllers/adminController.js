import { listUsers } from "../repositories/adminRepository.js";

export async function getUsers(req, res) {
  const users = await listUsers();
  res.json({ users });
}
