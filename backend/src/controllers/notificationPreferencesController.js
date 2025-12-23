import { getUserPrefs, upsertUserPrefs } from "../repositories/notificationPreferencesRepository.js";

const resolveUserId = (req) => req.user?.id;

export async function getNotificationPrefs(req, res) {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const prefs = await getUserPrefs(userId);
  res.json({ popupEnabled: prefs.popup_enabled !== false });
}

export async function updateNotificationPrefs(req, res) {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { popupEnabled } = req.body || {};
  if (typeof popupEnabled !== "boolean") {
    return res.status(400).json({ error: "popupEnabled must be boolean" });
  }
  const prefs = await upsertUserPrefs(userId, { popupEnabled });
  res.json({ popupEnabled: prefs.popup_enabled !== false });
}
