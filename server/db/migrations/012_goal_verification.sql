-- 012_goal_verification.sql
-- Goal completion verification: pending approval workflow, verification metadata,
-- and a full progress-change audit trail.

-- 1. Allow pending_approval as a goal status (must drop + recreate the CHECK).
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE goals ADD CONSTRAINT goals_status_check
  CHECK (status IN ('active', 'pending_approval', 'completed', 'cancelled'));

-- 2. Verification & rejection metadata (columns are NULL until a goal is verified/rejected).
ALTER TABLE goals ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS verified_comment TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS rejection_at TIMESTAMPTZ;

-- 3. Progress audit trail: records every change to progress or status.
CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  from_value NUMERIC(5,2),
  to_value NUMERIC(5,2),
  from_status TEXT,
  to_status TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'auto_kr', 'verify', 'reject', 'create')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS goal_progress_history_goal_idx ON goal_progress_history(goal_id, created_at DESC);

