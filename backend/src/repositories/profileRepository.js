import { query } from "../db.js";

const profileSelect = `
SELECT u.id,
       u.email,
       u.full_name AS "fullName",
       u.company,
       u.avatar_url AS "avatarUrl",
       u.created_at AS "createdAt",
       u.updated_at AS "updatedAt",
       p.phone,
       p.job_title AS "jobTitle",
       p.location,
       p.bio,
       p.website,
       p.preferences
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
`;

export async function selectProfileByUserId(userId) {
  const res = await query(`${profileSelect} WHERE u.id = $1`, [userId]);
  return res.rows[0] || null;
}

export async function upsertProfile(userId, { fullName, company, avatarUrl, phone, jobTitle, location, bio, website, preferences }) {
  // update core user fields (full_name, company, avatar_url)
  if (fullName || company || avatarUrl) {
    await query(
      `UPDATE users SET full_name = COALESCE($1, full_name), company = COALESCE($2, company), avatar_url = COALESCE($3, avatar_url), updated_at = NOW() WHERE id = $4`,
      [fullName || null, company || null, avatarUrl || null, userId]
    );
  }

  // ensure a row exists in user_profiles
  await query(
    `INSERT INTO user_profiles (user_id, phone, job_title, location, bio, website, preferences) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{}'::jsonb)) ON CONFLICT (user_id) DO UPDATE SET phone = COALESCE(EXCLUDED.phone, user_profiles.phone), job_title = COALESCE(EXCLUDED.job_title, user_profiles.job_title), location = COALESCE(EXCLUDED.location, user_profiles.location), bio = COALESCE(EXCLUDED.bio, user_profiles.bio), website = COALESCE(EXCLUDED.website, user_profiles.website), preferences = COALESCE(EXCLUDED.preferences, user_profiles.preferences), updated_at = NOW()`,
    [userId, phone || null, jobTitle || null, location || null, bio || null, website || null, preferences ? JSON.stringify(preferences) : null]
  );

  return selectProfileByUserId(userId);
}
