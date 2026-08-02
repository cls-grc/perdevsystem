-- 011_goals_feedback_deadlines.sql
-- 1) Workflow deadlines/SLA
-- 2) Goals / OKR tracking
-- 3) 360° peer feedback

-- 1. Workflow due dates & SLA
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 2. Goals / OKRs
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('personal','performance','learning','career')),
  objective TEXT,
  key_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  due_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS goals_employee_idx ON goals(employee_id, status);

-- 3. 360° feedback requests
CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  relationship TEXT NOT NULL DEFAULT 'peer' CHECK (relationship IN ('peer','supervisor','subordinate','self')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','closed')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_requests_subject_idx ON feedback_requests(subject_employee_id, status);

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES feedback_requests(id) ON DELETE CASCADE,
  author_employee_id UUID NOT NULL REFERENCES employees(id),
  strengths TEXT,
  improvements TEXT,
  overall_rating NUMERIC(3,1) CHECK (overall_rating BETWEEN 0 AND 5),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_submissions_request_idx ON feedback_submissions(request_id);

