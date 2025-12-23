import * as repo from "../repositories/notificationRepository.js";

const resolveUserId = (req) => {
  const userId = req.user?.id;
  const queryUserId = req.query?.userId;
  if (queryUserId && userId && String(queryUserId) !== String(userId)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return userId;
};

export async function listNotifications(req, res) {
  const userId = resolveUserId(req);
  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  const offset = Number(req.query?.offset) || 0;
  const tab = (req.query?.tab || "all").toString().toLowerCase();
  const sort = (req.query?.sort || "newest").toString().toLowerCase();
  const q = req.query?.q ? String(req.query.q) : undefined;

  const items = await repo.listNotifications({ userId, tab, q, sort, limit, offset });
  const total = await repo.countNotifications({ userId, tab, q });
  const counts = await repo.getCategoryCounts({ userId });

  res.json({
    items,
    total,
    counts,
  });
}

export async function createNotification(req, res) {
  const userId = resolveUserId(req);
  const payload = { ...req.body, user_id: req.body?.user_id || req.body?.userId || userId };
  const item = await repo.createNotification(payload);
  res.status(201).json({ data: item });
}

export async function deleteNotification(req, res) {
  const { id } = req.params;
  const userId = resolveUserId(req);
  const deleted = await repo.removeNotification(id, userId);
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
}

export async function updateNotification(req, res) {
  const { id } = req.params;
  const userId = resolveUserId(req);
  const update = req.body || {};
  const item = await repo.updateNotification(id, update, userId);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ data: item });
}
