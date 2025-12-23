-- Migration: enforce per-user notifications and indexing
-- Run manually against existing database.

-- 1) Add user_id column if missing (nullable first to allow backfill)
ALTER TABLE IF EXISTS notifications
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Backfill user_id for legacy rows here as needed.
-- Example: update from metadata if present (adjust to real source):
-- UPDATE notifications SET user_id = (metadata->>'user_id')::uuid WHERE user_id IS NULL AND metadata ? 'user_id';

-- Option A: remove orphaned rows with unknown owner
-- DELETE FROM notifications WHERE user_id IS NULL;
-- Option B: assign to a system user (replace with actual system user id)
-- UPDATE notifications SET user_id = '<system-user-uuid>' WHERE user_id IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE notifications
ALTER COLUMN user_id SET NOT NULL;

-- 4) Tighten core columns
ALTER TABLE notifications
ALTER COLUMN message SET NOT NULL;

-- 5) Indexes for fast per-user reads
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, is_read);
