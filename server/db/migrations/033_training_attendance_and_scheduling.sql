-- 033_training_attendance_and_scheduling.sql
-- Enhanced Training Scheduling & Persistent Attendance Tracking

-- 1. Venues / Facilities Table
CREATE TABLE IF NOT EXISTS training_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  building TEXT DEFAULT 'Main Hotel',
  floor TEXT,
  capacity INT NOT NULL DEFAULT 40,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Hotel Training Venues
INSERT INTO training_venues (name, building, floor, capacity) VALUES
  ('Training Room A', 'Main Hotel', '2nd Floor', 35),
  ('Training Room B', 'Main Hotel', '2nd Floor', 30),
  ('Conference Room A', 'Executive Tower', '3rd Floor', 25),
  ('Executive Boardroom', 'Executive Tower', '5th Floor', 20),
  ('Operations Training Area', 'Service Wing', 'Ground Floor', 50),
  ('Grand Palm Ballroom / Training Hall B', 'Convention Center', '1st Floor', 100),
  ('Main Culinary Kitchen / Lecture Room 1', 'Culinary Center', 'Lower Ground', 30)
ON CONFLICT (name) DO NOTHING;

-- 2. Enhance training_sessions with datetime & attendance window fields
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES training_venues(id);

-- Backfill datetimes for existing records
UPDATE training_sessions
SET 
  start_datetime = (start_date + start_time)::timestamptz,
  end_datetime = (COALESCE(end_date, start_date) + COALESCE(end_time, start_time + interval '2 hours'))::timestamptz,
  attendance_window_start = (start_date + start_time)::timestamptz - interval '10 minutes',
  attendance_window_end = (start_date + start_time)::timestamptz + interval '15 minutes'
WHERE start_datetime IS NULL;

-- Link existing venues if match found
UPDATE training_sessions ts
SET venue_id = tv.id
FROM training_venues tv
WHERE ts.venue = tv.name AND ts.venue_id IS NULL;

-- 3. Dedicated Training Attendance Records Table
CREATE TABLE IF NOT EXISTS training_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  scan_method TEXT NOT NULL DEFAULT 'qr_self_scan' CHECK (scan_method IN ('qr_self_scan', 'badge_scan', 'manual_hr')),
  scanned_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS training_att_rec_session_idx ON training_attendance_records(session_id, attendance_date);
CREATE INDEX IF NOT EXISTS training_att_rec_employee_idx ON training_attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS training_att_rec_timein_idx ON training_attendance_records(time_in);

-- 4. Backfill existing attendance history from training_participants
INSERT INTO training_attendance_records (
  session_id,
  employee_id,
  attendance_date,
  time_in,
  status,
  scan_method,
  scanned_by,
  created_at,
  updated_at
)
SELECT 
  tp.session_id,
  tp.employee_id,
  ts.start_date AS attendance_date,
  COALESCE(tp.attendance_recorded_at, (ts.start_date + ts.start_time)::timestamptz) AS time_in,
  tp.attendance AS status,
  'badge_scan' AS scan_method,
  tp.attendance_recorded_by AS scanned_by,
  COALESCE(tp.attendance_recorded_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM training_participants tp
JOIN training_sessions ts ON tp.session_id = ts.id
WHERE tp.attendance IN ('present', 'late')
ON CONFLICT (session_id, employee_id, attendance_date) DO NOTHING;
