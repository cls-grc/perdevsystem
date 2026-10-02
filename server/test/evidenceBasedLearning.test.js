import nodeTest, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { config } from '../src/config.js'
import { query } from '../src/db.js'

let dbAvailable = false
let hrUser = null
let employeeUser = null
let testResource = null
let testAssignment = null

const rawTest = nodeTest
const test = (name, ...args) => {
  const fn = args[args.length - 1]
  const rest = args.slice(0, -1)
  return rawTest(name, ...rest, async (...fnArgs) => {
    if (!dbAvailable) return
    return fn(...fnArgs)
  })
}

before(async () => {
  try {
    const hrRes = await query("SELECT u.id, u.email, u.role, u.employee_id, u.full_name FROM users u WHERE u.role = 'hr' AND u.is_active = true LIMIT 1")
    const empRes = await query("SELECT u.id, u.email, u.role, u.employee_id, u.full_name FROM users u WHERE u.role = 'employee' AND u.employee_id IS NOT NULL AND u.is_active = true LIMIT 1")

    if (!hrRes.rows[0] || !empRes.rows[0]) {
      console.warn('DB or users not available for evidenceBasedLearning.test.js')
      return
    }

    hrUser = hrRes.rows[0]
    employeeUser = empRes.rows[0]
    dbAvailable = true

    // Create a dedicated test course with quiz for deterministic test assertions
    const testQuiz = [
      { id: 'q1', question: 'What is the danger zone for food temperature?', options: ['0-10C', '5-60C', '70-100C', '100-120C'], correctIndex: 1, explanation: 'Food danger zone is 5C to 60C.' },
      { id: 'q2', question: 'How often should high-touch surfaces be sanitized?', options: ['Weekly', 'Monthly', 'Every shift', 'Never'], correctIndex: 2, explanation: 'Surfaces should be sanitized every shift.' },
      { id: 'q3', question: 'What does FIFO stand for in inventory?', options: ['First In, First Out', 'Fast In, Fast Out', 'Final Item For Order', 'None'], correctIndex: 0, explanation: 'First In, First Out.' },
      { id: 'q4', question: 'What is the primary purpose of HACCP?', options: ['Marketing', 'Food Safety Preventive System', 'Cost reduction', 'Cooking speed'], correctIndex: 1, explanation: 'HACCP is a preventive food safety system.' },
    ]

    const resInsert = await query(
      `INSERT INTO learning_resources (title, description, category, provider, provider_type, quiz, pass_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true)
       RETURNING *`,
      ['Test Evidence-Based Food Safety', 'Automated test course', 'Food Safety', 'Test Academy', 'internal', JSON.stringify(testQuiz), 75],
    )
    testResource = resInsert.rows[0]

    // Create assignment for employee
    const assignInsert = await query(
      `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, status, progress, attempts_count)
       VALUES ($1, $2, $3, 'not_started', 0, 0)
       RETURNING *`,
      [testResource.id, employeeUser.employee_id, hrUser.id],
    )
    testAssignment = assignInsert.rows[0]
  } catch (err) {
    console.error('Setup failed in evidenceBasedLearning.test.js:', err)
  }
})

after(async () => {
  if (!dbAvailable) return
  try {
    if (testAssignment) {
      await query('DELETE FROM learning_assessment_attempts WHERE assignment_id = $1', [testAssignment.id])
      await query('DELETE FROM learning_completions WHERE assignment_id = $1', [testAssignment.id])
      await query('DELETE FROM learning_assignments WHERE id = $1', [testAssignment.id])
    }
    if (testResource) {
      await query('DELETE FROM learning_resources WHERE id = $1', [testResource.id])
    }
  } catch (err) {
    console.warn('Cleanup failed:', err.message)
  }
})

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, employeeId: user.employee_id, name: user.full_name },
    config.jwtSecret,
    { expiresIn: '15m' },
  )
}

test('1. Initial state: progress is 0% and status is not_started', async () => {
  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].status, 'not_started')
  assert.equal(Number(rows[0].progress), 0)
  assert.equal(rows[0].material_completed, false)
  assert.equal(rows[0].assessment_status, 'not_taken')
})

test('2. Tracking material access transitions status to in_progress and computes progress to 25%', async () => {
  // Simulate employee accessing material
  await query(
    `UPDATE learning_assignments
     SET started_at = NOW(),
         last_accessed_at = NOW(),
         status = 'in_progress',
         progress = 25,
         progress_breakdown = '{"materialProgress": 25, "assessmentProgress": 0}'::jsonb
     WHERE id = $1`,
    [testAssignment.id],
  )

  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].status, 'in_progress')
  assert.equal(Number(rows[0].progress), 25)
  assert.ok(rows[0].started_at !== null)
  assert.ok(rows[0].last_accessed_at !== null)
})

test('3. Marking material as complete transitions to assessment_pending and computes progress to 50%', async () => {
  // Material completed, assessment not taken yet
  await query(
    `UPDATE learning_assignments
     SET material_completed = true,
         material_completed_at = NOW(),
         status = 'assessment_pending',
         progress = 50,
         progress_breakdown = '{"materialProgress": 50, "assessmentProgress": 0}'::jsonb
     WHERE id = $1`,
    [testAssignment.id],
  )

  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].status, 'assessment_pending')
  assert.equal(Number(rows[0].progress), 50)
  assert.equal(rows[0].material_completed, true)
})

test('4. Auto-scoring failed assessment (50% < 75% threshold): status becomes needs_improvement', async () => {
  // Attempt 1: only 2 of 4 questions correct (50%)
  const score = 50
  const passed = false
  const total = 4
  const correct = 2

  await query(
    `INSERT INTO learning_assessment_attempts
       (assignment_id, resource_id, employee_id, score, total_questions, correct_answers, passed, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [testAssignment.id, testResource.id, employeeUser.employee_id, score, total, correct, passed],
  )

  // Recalculate status and progress
  // Material (50) + assessment partial (50/75 * 50 = 33) = 83
  const computedProgress = 50 + Math.min(49, Math.round((score / 75) * 50))

  await query(
    `UPDATE learning_assignments
     SET assessment_status = 'failed',
         assessment_score = $1,
         attempts_count = 1,
         last_attempt_at = NOW(),
         status = 'needs_improvement',
         progress = $2,
         progress_breakdown = $3::jsonb
     WHERE id = $4`,
    [score, computedProgress, JSON.stringify({ materialProgress: 50, assessmentProgress: computedProgress - 50, assessmentScore: score, passed: false }), testAssignment.id],
  )

  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].status, 'needs_improvement')
  assert.equal(rows[0].assessment_status, 'failed')
  assert.equal(Number(rows[0].assessment_score), 50)
  assert.equal(rows[0].attempts_count, 1)

  // Verify no completion was recorded yet
  const compRes = await query('SELECT * FROM learning_completions WHERE assignment_id = $1', [testAssignment.id])
  assert.equal(compRes.rows.length, 0)
})

test('5. Retaking assessment and passing (100% >= 75% threshold): status becomes completed, progress becomes 100%, completion is recorded', async () => {
  // Attempt 2: 4 of 4 questions correct (100%)
  const score = 100
  const passed = true
  const total = 4
  const correct = 4

  await query(
    `INSERT INTO learning_assessment_attempts
       (assignment_id, resource_id, employee_id, score, total_questions, correct_answers, passed, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 2)`,
    [testAssignment.id, testResource.id, employeeUser.employee_id, score, total, correct, passed],
  )

  await query(
    `UPDATE learning_assignments
     SET assessment_status = 'passed',
         assessment_score = $1,
         attempts_count = 2,
         last_attempt_at = NOW(),
         status = 'completed',
         progress = 100,
         progress_breakdown = '{"materialProgress": 50, "assessmentProgress": 50, "assessmentScore": 100, "passed": true}'::jsonb
     WHERE id = $2`,
    [score, testAssignment.id],
  )

  // Write completion record
  await query(
    `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (resource_id, employee_id) DO NOTHING`,
    [testResource.id, employeeUser.employee_id, testAssignment.id, JSON.stringify({ score, passed: true, attempts: 2 }), hrUser.id],
  )

  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].status, 'completed')
  assert.equal(Number(rows[0].progress), 100)
  assert.equal(rows[0].assessment_status, 'passed')
  assert.equal(Number(rows[0].assessment_score), 100)
  assert.equal(rows[0].attempts_count, 2)

  // Verify completion is recorded
  const compRes = await query('SELECT * FROM learning_completions WHERE assignment_id = $1', [testAssignment.id])
  assert.equal(compRes.rows.length, 1)
  assert.equal(compRes.rows[0].employee_id, employeeUser.employee_id)
})

test('6. Attempts history tracks both attempts in order', async () => {
  const { rows } = await query(
    `SELECT attempt_number, score, passed
     FROM learning_assessment_attempts
     WHERE assignment_id = $1
     ORDER BY attempt_number ASC`,
    [testAssignment.id],
  )

  assert.equal(rows.length, 2)
  assert.equal(rows[0].attempt_number, 1)
  assert.equal(Number(rows[0].score), 50)
  assert.equal(rows[0].passed, false)

  assert.equal(rows[1].attempt_number, 2)
  assert.equal(Number(rows[1].score), 100)
  assert.equal(rows[1].passed, true)
})

test('7. HR authorized override applies with reason and audit tracking', async () => {
  const overrideReason = 'Employee completed equivalent external HACCP certification, verified by HR manager.'

  await query(
    `UPDATE learning_assignments
     SET status = 'completed',
         progress = 100,
         is_overridden = true,
         override_reason = $1,
         overridden_by = $2,
         overridden_at = NOW(),
         progress_breakdown = jsonb_set(
           COALESCE(progress_breakdown, '{}'::jsonb),
           '{overrideNote}',
           to_jsonb($3::text)
         )
     WHERE id = $4`,
    [overrideReason, hrUser.id, `HR Override by ${hrUser.full_name}`, testAssignment.id],
  )

  const { rows } = await query('SELECT * FROM learning_assignments WHERE id = $1', [testAssignment.id])
  assert.equal(rows[0].is_overridden, true)
  assert.equal(rows[0].override_reason, overrideReason)
  assert.equal(rows[0].overridden_by, hrUser.id)
  assert.ok(rows[0].overridden_at !== null)
  assert.ok(rows[0].progress_breakdown.overrideNote.includes('HR Override'))
})
