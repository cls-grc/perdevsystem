-- 013_goal_cancellation.sql
-- Track who cancelled a goal, when, and why — so cancelled goals are auditable.

ALTER TABLE goals ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

