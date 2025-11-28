import { selectProfileByUserId, upsertProfile } from "../repositories/profileRepository.js";

export async function getProfile(req, res) {
  try {
    const userId = req.user?.id;
    const profile = await selectProfileByUserId(userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json({ profile });
  } catch (err) {
    console.error("getProfile error", err);
    res.status(500).json({ error: "Unable to fetch profile" });
  }
}

export async function patchProfile(req, res) {
  try {
    const userId = req.user?.id;
    const payload = req.body || {};
    // Accept a flexible payload: { fullName, company, avatarUrl, phone, jobTitle, location, bio, website, preferences }
    const updated = await upsertProfile(userId, payload);
    res.json({ profile: updated });
  } catch (err) {
    console.error("patchProfile error", err);
    res.status(500).json({ error: "Unable to update profile" });
  }
}
