import { HttpError } from "../utils/httpError.js";
import { insertActivity } from "../repositories/activityRepository.js";
import {
  listAdminNotifications,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
} from "../repositories/adminNotificationRepository.js";
import { getUsersByIds } from "../repositories/adminRepository.js";

export async function listAdminNotificationsController(req, res) {
  const { unreadOnly } = req.query;
  const unread = unreadOnly === "true" || unreadOnly === true;
  try {
    const notifications = await listAdminNotifications({ limit: 200, unreadOnly: unread });
    const userIds = Array.from(new Set(notifications.map((n) => n.userId).filter(Boolean))).map(String);
    const users = userIds.length ? await getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const mapped = notifications.map((n) => {
      const owner = n.userId ? userMap.get(String(n.userId)) : null;
      return {
        ...n,
        userName: owner ? owner.name || owner.email : null,
        userEmail: owner?.email || null,
      };
    });
    res.json({ notifications: mapped });
  } catch (err) {
    if (err.code === "42P01") {
      console.warn("notifications table missing; returning empty list");
      return res.json({ notifications: [] });
    }
    throw err;
  }
}

export async function createAdminNotificationController(req, res) {
  const { title, message, type, metadata, userId, read } = req.body || {};
  if (!title) throw new HttpError(400, "Title is required");
  const targetUserId = userId || req.user?.id;
  if (!targetUserId) throw new HttpError(400, "userId is required");
  const notification = await createAdminNotification({
    title,
    message,
    type,
    metadata,
    read,
    userId: targetUserId,
  });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "notification.create",
      targetType: "notification",
      targetId: notification.id,
      metadata: { title, userId: targetUserId },
    });
  } catch (err) {
    console.warn("Failed to log activity (notification.create):", err.message);
  }
  res.status(201).json({ notification });
}

export async function updateAdminNotificationController(req, res) {
  const { id } = req.params;
  const { title, message, type, metadata, read } = req.body || {};
  const notification = await updateAdminNotification(id, { title, message, type, metadata, read });
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "notification.update",
      targetType: "notification",
      targetId: id,
      metadata: { read, title, type },
    });
  } catch (err) {
    console.warn("Failed to log activity (notification.update):", err.message);
  }
  res.json({ notification });
}

export async function deleteAdminNotificationController(req, res) {
  const { id } = req.params;
  await deleteAdminNotification(id);
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "notification.delete",
      targetType: "notification",
      targetId: id,
      metadata: {},
    });
  } catch (err) {
    console.warn("Failed to log activity (notification.delete):", err.message);
  }
  res.json({ success: true });
}
