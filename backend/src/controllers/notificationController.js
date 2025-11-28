import * as repo from "../repositories/notificationRepository.js";

export async function listNotifications(req, res) {
  const items = await repo.listNotifications();
  res.json({ data: items });
}

export async function createNotification(req, res) {
  const payload = req.body;
  const item = await repo.createNotification(payload);
  res.status(201).json({ data: item });
}

export async function deleteNotification(req, res) {
  const { id } = req.params;
  await repo.removeNotification(id);
  res.status(204).end();
}

export async function updateNotification(req, res) {
  const { id } = req.params;
  const update = req.body || {};
  const item = await repo.updateNotification(id, update);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
}
