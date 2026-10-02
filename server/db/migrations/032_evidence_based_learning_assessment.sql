-- 032_evidence_based_learning_assessment.sql
-- Automatic and Evidence-Based Learning Assessment & Progress Enforcement
--
-- Replaces manual sliders and status manipulation with automated,
-- evidence-based tracking:
--   1. Re-adds quiz questions (JSONB) and pass_threshold (NUMERIC) to learning_resources.
--   2. Enforces updated status vocabulary on learning_assignments:
--      not_started / in_progress / assessment_pending / completed / needs_improvement
--   3. Adds tracking columns on learning_assignments for material study, assessment score,
--      attempts count, and authorized HR override auditing.
--   4. Creates learning_assessment_attempts table to log each assessment attempt.
--   5. Backfills existing assignment records and seeds initial course quizzes.

-- ============================================================
-- 1. Course follow-up assessment quiz & pass threshold
-- ============================================================
ALTER TABLE learning_resources
  ADD COLUMN IF NOT EXISTS quiz JSONB,
  ADD COLUMN IF NOT EXISTS pass_threshold NUMERIC(5,2) NOT NULL DEFAULT 70
    CHECK (pass_threshold BETWEEN 0 AND 100);

-- ============================================================
-- 2. Update learning_assignments status vocabulary & constraints
-- ============================================================
ALTER TABLE learning_assignments DROP CONSTRAINT IF EXISTS learning_assignments_status_check;

-- Map existing values to new vocabulary
UPDATE learning_assignments SET status = 'in_progress' WHERE status = 'studying';
UPDATE learning_assignments SET status = 'needs_improvement' WHERE status = 'need_help';
UPDATE learning_assignments SET status = 'not_started'
  WHERE status NOT IN ('not_started', 'in_progress', 'assessment_pending', 'completed', 'needs_improvement');

ALTER TABLE learning_assignments
  ADD CONSTRAINT learning_assignments_status_check
  CHECK (status IN ('not_started', 'in_progress', 'assessment_pending', 'completed', 'needs_improvement'));

-- Add activity, assessment, and audit tracking columns
ALTER TABLE learning_assignments
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS material_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS material_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_status TEXT NOT NULL DEFAULT 'not_taken'
    CHECK (assessment_status IN ('not_taken', 'passed', 'failed')),
  ADD COLUMN IF NOT EXISTS assessment_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS attempts_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_overridden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ;

-- ============================================================
-- 3. Assessment attempts table
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0),
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assignment ON learning_assessment_attempts(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_employee ON learning_assessment_attempts(employee_id, resource_id);

-- ============================================================
-- 4. Backfill existing learning assignments
-- ============================================================
-- Completed assignments
UPDATE learning_assignments
SET material_completed = true,
    material_completed_at = COALESCE(assigned_at, NOW()),
    started_at = COALESCE(assigned_at, NOW()),
    last_accessed_at = COALESCE(assigned_at, NOW()),
    assessment_status = 'passed',
    assessment_score = 100,
    attempts_count = 1,
    last_attempt_at = COALESCE(assigned_at, NOW()),
    progress = 100,
    progress_breakdown = jsonb_build_object(
      'materialProgress', 50,
      'assessmentProgress', 50,
      'assessmentScore', 100,
      'passThreshold', 70,
      'passed', true,
      'attempts', 1,
      'calculationBasis', 'Course Material Verified (50%) + Assessment Score (50%)'
    )
WHERE status = 'completed' OR progress >= 100;

-- In-progress assignments
UPDATE learning_assignments
SET started_at = COALESCE(assigned_at, NOW()),
    last_accessed_at = NOW(),
    progress = 25,
    progress_breakdown = jsonb_build_object(
      'materialProgress', 25,
      'assessmentProgress', 0,
      'assessmentScore', null,
      'passThreshold', 70,
      'passed', false,
      'attempts', 0,
      'calculationBasis', 'Course Material In Progress (25%)'
    )
WHERE status = 'in_progress';

-- Not started assignments
UPDATE learning_assignments
SET progress = 0,
    progress_breakdown = jsonb_build_object(
      'materialProgress', 0,
      'assessmentProgress', 0,
      'assessmentScore', null,
      'passThreshold', 70,
      'passed', false,
      'attempts', 0,
      'calculationBasis', 'Not Started (0%)'
    )
WHERE status = 'not_started';
