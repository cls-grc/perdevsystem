import { getScopeFilter, verifyEmployeeAccess } from '../services/departmentScope.js'
import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { generateDevelopmentPlan } from '../services/openrouter.js'

const router = Router()

// ---------------------------------------------------------------------------
// Learning Resource / Course Library API — Evidence-Based Assessment System
//
// Progress is fully automatic. Manual sliders are removed. Status is derived
// by the server from actual evidence:
//
//   not_started         → no material access yet
//   in_progress         → employee has accessed material (started)
//   assessment_pending  → material completed, assessment not yet taken
//   completed           → material done AND assessment PASSED
//   needs_improvement   → assessment attempted but not passed
//
// Completion percentage calculation:
//   progress = materialWeight (50%) + assessmentWeight (50%)
//   materialWeight:
//     0%   = not_started
//     25%  = started (in_progress)
//     50%  = material_completed
//   assessmentWeight (only if material completed):
//     0%   = not taken
//     0–50% = score / passThreshold * 50% if not passed
//     50%  = passed
//
// HR override is allowed but is recorded in the audit log.
// ---------------------------------------------------------------------------

// ─── Schemas ────────────────────────────────────────────────────────────────
const resourceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(3000),
  category: z.string().min(2).max(120),
  provider: z.string().max(200).optional().default(''),
  providerType: z.enum(['internal', 'external']).default('internal'),
  durationHours: z.coerce.number().nonnegative().max(1000).nullable().optional(),
  objectives: z.string().max(4000).optional().default(''),
  url: z.string().max(1000).optional().default(''),
  videoUrl: z.string().max(1000).optional().default(''),
  pdfUrl: z.string().max(1000).optional().default(''),
  lessonContent: z.string().max(50000).optional().default(''),
  competencies: z.array(z.string().min(1).max(120)).max(50).default([]),
  quiz: z.array(z.unknown()).optional().default([]),
  passThreshold: z.coerce.number().min(0).max(100).optional().default(75),
})

const assignSchema = z.object({
  resourceId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  dueDate: z.string().date().nullable().optional(),
})

const assessmentSubmitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    selectedIndex: z.number().int().min(0),
  })).min(1),
})

const overrideSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'assessment_pending', 'completed', 'needs_improvement']),
  progress: z.coerce.number().min(0).max(100),
  reason: z.string().min(5).max(1000),
})

const completionSchema = z.object({
  resourceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  assessment: z.record(z.unknown()).default({}),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate computed progress % and determine status from evidence columns.
 * @param {object} a  – learning_assignments row
 * @param {number} passThreshold – e.g. 75
 */
function computeProgressAndStatus(a, passThreshold = 75) {
  const pt = Number(passThreshold) || 75

  // Material component (50 pts max)
  let materialPts = 0
  if (a.material_completed) {
    materialPts = 50
  } else if (a.started_at) {
    materialPts = 25
  }

  // Assessment component (50 pts max)
  let assessmentPts = 0
  if (a.assessment_status === 'passed') {
    assessmentPts = 50
  } else if (a.assessment_status === 'failed' && a.assessment_score != null) {
    // Partial credit proportional to score vs threshold, capped at 49
    assessmentPts = Math.min(49, Math.round((Number(a.assessment_score) / pt) * 50))
  }

  const progress = materialPts + assessmentPts

  // Determine status
  let status = 'not_started'
  if (a.is_overridden) {
    // Preserve overridden status but recalc progress
    status = a.status
  } else if (a.assessment_status === 'passed' && a.material_completed) {
    status = 'completed'
  } else if (a.assessment_status === 'failed') {
    status = 'needs_improvement'
  } else if (a.material_completed) {
    status = 'assessment_pending'
  } else if (a.started_at) {
    status = 'in_progress'
  }

  return {
    progress,
    status,
    progressBreakdown: {
      materialProgress: materialPts,
      assessmentProgress: assessmentPts,
      assessmentScore: a.assessment_score != null ? Number(a.assessment_score) : null,
      passThreshold: pt,
      passed: a.assessment_status === 'passed',
      attempts: Number(a.attempts_count) || 0,
      calculationBasis: `Course Material (${materialPts}/50 pts) + Assessment (${assessmentPts}/50 pts)`,
    },
  }
}

/** Sync computed progress and status back to the DB and employee aggregate. */
async function syncAssignmentProgress(client, assignment, passThreshold) {
  const { progress, status, progressBreakdown } = computeProgressAndStatus(assignment, passThreshold)

  await client.query(
    `UPDATE learning_assignments
     SET progress = $1,
         status   = $2,
         progress_breakdown = $3::jsonb
     WHERE id = $4`,
    [progress, status, JSON.stringify(progressBreakdown), assignment.id],
  )

  // Sync employee aggregate learning_progress
  await client.query(
    `UPDATE employees
     SET learning_progress = (
       SELECT COALESCE(ROUND(AVG(progress)), 0)
       FROM learning_assignments
       WHERE employee_id = $1
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [assignment.employee_id],
  )

  return { progress, status, progressBreakdown }
}

/** Record or update learning_completions only when genuinely completed. */
async function handleCompletion(client, assignment, actorId, assessmentData = {}) {
  if (assignment.assessment_status !== 'passed' || !assignment.material_completed) return

  await client.query(
    `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (resource_id, employee_id) DO UPDATE
       SET assessment_result = EXCLUDED.assessment_result,
           completed_at      = NOW()`,
    [
      assignment.resource_id,
      assignment.employee_id,
      assignment.id,
      JSON.stringify({
        evidenceBased: true,
        assessmentScore: assignment.assessment_score,
        attempts: assignment.attempts_count,
        ...assessmentData,
      }),
      actorId,
    ],
  )

  // Lift linked competency scores
  const comps = await client.query(
    'SELECT competency FROM learning_resource_competencies WHERE resource_id=$1',
    [assignment.resource_id],
  )
  for (const { competency } of comps.rows) {
    await client.query(
      `UPDATE competency_assessments
       SET score       = LEAST(100, GREATEST(required_score, score + 18)),
           source      = 'learning_completion',
           assessed_at = NOW(),
           updated_at  = NOW()
       WHERE employee_id = $1 AND LOWER(competency) = LOWER($2)`,
      [assignment.employee_id, competency],
    )
  }

  // Recalculate aggregate competency score
  await client.query(
    `UPDATE employees
     SET competency_score = (
       SELECT COALESCE(ROUND(AVG(score)), 80)
       FROM competency_assessments
       WHERE employee_id = $1
     )
     WHERE id = $1`,
    [assignment.employee_id],
  )

  // Close linked learning workflows
  await client.query(
    `UPDATE workflows
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE module = 'learning'
       AND subject_employee_id = $1
       AND status = 'active'
       AND metadata->>'courseTitle' = (SELECT title FROM learning_resources WHERE id = $2)`,
    [assignment.employee_id, assignment.resource_id],
  )
}

// ─── Competency maps (unchanged from original) ───────────────────────────────
const ROLE_COMPETENCY_MAP = {
  'Front Desk Officer': [
    { comp: 'Customer Service', req: 90, offset: -8 },
    { comp: 'Communication', req: 88, offset: -6 },
    { comp: 'Reservation Management', req: 88, offset: -10 },
    { comp: 'Conflict Resolution', req: 80, offset: -5 },
    { comp: 'Hospitality SOP Compliance', req: 85, offset: 2 },
  ],
  'Head Concierge': [
    { comp: 'Customer Service', req: 95, offset: -8 },
    { comp: 'Communication', req: 90, offset: -6 },
    { comp: 'Reservation Management', req: 90, offset: -7 },
    { comp: 'Conflict Resolution', req: 85, offset: 2 },
    { comp: 'Hospitality SOP Compliance', req: 90, offset: -4 },
  ],
  'Sous Chef': [
    { comp: 'Line Expediting & Speed', req: 90, offset: -8 },
    { comp: 'Recipe Consistency & Flavor', req: 90, offset: -6 },
    { comp: 'HACCP & Kitchen Sanitation', req: 95, offset: -12 },
    { comp: 'Food Safety', req: 90, offset: -5 },
    { comp: 'Prep & Station Inventory', req: 85, offset: 2 },
  ],
  'Executive Chef': [
    { comp: 'Line Expediting & Speed', req: 95, offset: -6 },
    { comp: 'Recipe Consistency & Flavor', req: 95, offset: -6 },
    { comp: 'HACCP & Kitchen Sanitation', req: 98, offset: -8 },
    { comp: 'Food Safety', req: 95, offset: -5 },
    { comp: 'Prep & Station Inventory', req: 90, offset: 2 },
  ],
  'Restaurant Supervisor': [
    { comp: 'Floor Operations & Speed', req: 90, offset: -8 },
    { comp: 'Customer Service', req: 90, offset: -7 },
    { comp: 'POS & Cash Reconciliation', req: 85, offset: -5 },
    { comp: 'Hygiene & Health Standards', req: 88, offset: -9 },
    { comp: 'Team Collaboration', req: 85, offset: 2 },
  ],
  'Housekeeping Executive': [
    { comp: 'Room Standards & Inspection', req: 95, offset: -10 },
    { comp: 'Chemical & Bio-Safety Compliance', req: 90, offset: -6 },
    { comp: 'Turnaround Time Optimization', req: 85, offset: -8 },
    { comp: 'Linen & Inventory Management', req: 85, offset: 2 },
    { comp: 'Hospitality SOP Compliance', req: 85, offset: -4 },
  ],
}

const DEPARTMENT_COMPETENCY_MAP = {
  'Front Office': [
    { comp: 'Customer Service', req: 90, offset: -8 },
    { comp: 'Communication', req: 88, offset: -6 },
    { comp: 'Reservation Management', req: 88, offset: -10 },
    { comp: 'Conflict Resolution', req: 80, offset: -5 },
    { comp: 'Hospitality SOP Compliance', req: 85, offset: 2 },
  ],
  'Kitchen': [
    { comp: 'Line Expediting & Speed', req: 90, offset: -8 },
    { comp: 'Recipe Consistency & Flavor', req: 90, offset: -6 },
    { comp: 'HACCP & Kitchen Sanitation', req: 95, offset: -12 },
    { comp: 'Food Safety', req: 90, offset: -5 },
    { comp: 'Prep & Station Inventory', req: 85, offset: 2 },
  ],
  'Food & Beverage': [
    { comp: 'Floor Operations & Speed', req: 90, offset: -8 },
    { comp: 'Customer Service', req: 90, offset: -7 },
    { comp: 'POS & Cash Reconciliation', req: 85, offset: -5 },
    { comp: 'Hygiene & Health Standards', req: 88, offset: -9 },
    { comp: 'Team Collaboration', req: 85, offset: 2 },
  ],
  'Housekeeping': [
    { comp: 'Room Standards & Inspection', req: 95, offset: -10 },
    { comp: 'Chemical & Bio-Safety Compliance', req: 90, offset: -6 },
    { comp: 'Turnaround Time Optimization', req: 85, offset: -8 },
    { comp: 'Linen & Inventory Management', req: 85, offset: 2 },
    { comp: 'Hospitality SOP Compliance', req: 85, offset: -4 },
  ],
  'Human Resources': [
    { comp: 'Employee Relations', req: 88, offset: -7 },
    { comp: 'Recruitment', req: 88, offset: -8 },
    { comp: 'Compliance', req: 88, offset: -5 },
    { comp: 'Communication', req: 80, offset: 2 },
    { comp: 'Leadership', req: 80, offset: -4 },
  ],
  'default': [
    { comp: 'Operational Management', req: 95, offset: -8 },
    { comp: 'Leadership', req: 95, offset: -6 },
    { comp: 'Financial Acumen', req: 88, offset: -7 },
    { comp: 'Customer Service', req: 88, offset: 2 },
    { comp: 'Communication', req: 88, offset: -4 },
  ],
}

router.use(authenticate)

// ─── Competencies ────────────────────────────────────────────────────────────
router.get('/competencies', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT competency FROM learning_resource_competencies ORDER BY competency`,
    )
    const base = ['Customer Service', 'Leadership', 'Communication', 'Food Safety', 'Kitchen Operations', 'Compliance', 'Conflict Resolution', 'Technical Skills', 'Reservation Management', 'Upselling', 'Operational Management', 'Financial Acumen', 'Teamwork']
    const tags = [...new Set([...base, ...rows.map(r => r.competency)])].sort()
    res.json({ competencies: tags })
  } catch (error) { next(error) }
})

// ─── Skill-gap detection ──────────────────────────────────────────────────────
router.get('/skill-gaps', async (req, res, next) => {
  try {
    const { employeeId } = req.query
    const scope = await getScopeFilter(req.user)

    if (employeeId) {
      const countRes = await query('SELECT count(*)::int as count FROM competency_assessments WHERE employee_id=$1', [employeeId])
      if (Number(countRes.rows[0]?.count || 0) === 0) {
        const empRes = await query('SELECT competency_score, department, job_title FROM employees WHERE id=$1', [employeeId])
        const emp = empRes.rows[0]
        if (emp) {
          const baseScore = Number(emp.competency_score) || 75
          const seedComps = ROLE_COMPETENCY_MAP[emp.job_title] ||
            DEPARTMENT_COMPETENCY_MAP[emp.department] ||
            DEPARTMENT_COMPETENCY_MAP['default']
          for (const s of seedComps) {
            const score = Math.max(35, Math.min(100, Math.round(baseScore + s.offset)))
            await query(
              `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
               VALUES ($1, $2, $3, $4, 'baseline')
               ON CONFLICT (employee_id, competency) DO NOTHING`,
              [employeeId, s.comp, score, s.req],
            )
          }
        }
      }
    }

    let where = 'WHERE 1=1'
    const params = []
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    } else if (employeeId) {
      await verifyEmployeeAccess(req.user, employeeId)
      params.push(employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT ca.employee_id, ca.competency, ca.score, ca.required_score,
              (ca.required_score - ca.score)::int AS gap,
              e.full_name AS employee_name, e.job_title, e.department,
              e.competency_score AS aggregate_competency_score
       FROM competency_assessments ca
       JOIN employees e ON e.id = ca.employee_id
       ${where} AND ca.score < ca.required_score
       ORDER BY gap DESC, e.full_name ASC`,
      params,
    )
    const gapsWithCourses = await Promise.all(
      rows.map(async g => {
        const matchingResources = await query(
          `SELECT r.*,
                  la.id AS assignment_id,
                  la.status AS assignment_status,
                  la.progress AS assignment_progress,
                  la.due_date AS assignment_due_date,
                  la.assessment_score AS assignment_assessment_score,
                  la.assessment_status AS assignment_assessment_status,
                  la.attempts_count AS assignment_attempts,
                  la.progress_breakdown AS assignment_progress_breakdown,
                  (lc.id IS NOT NULL) AS is_completed,
                  lc.completed_at,
                  lc.assessment_result
           FROM learning_resources r
           JOIN learning_resource_competencies lrc ON lrc.resource_id = r.id
           LEFT JOIN learning_assignments la ON la.resource_id = r.id AND la.employee_id = $2
           LEFT JOIN learning_completions lc ON lc.resource_id = r.id AND lc.employee_id = $2
           WHERE r.is_active = true AND LOWER(lrc.competency) = LOWER($1)
           ORDER BY r.title ASC`,
          [g.competency, g.employee_id],
        )
        return {
          ...g,
          courses: matchingResources.rows,
          recommendedResources: matchingResources.rows,
        }
      }),
    )
    res.json({ skillGaps: gapsWithCourses, gaps: gapsWithCourses })
  } catch (error) { next(error) }
})

// ─── Recommendations ──────────────────────────────────────────────────────────
router.get('/recommendations', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const empId = scope.isEmployee ? scope.employeeId : (req.query.employeeId || scope.employeeId)
    if (!empId) return res.status(400).json({ error: 'Employee ID is required for tailored recommendations.' })
    const empRes = await query('SELECT id, full_name, department, job_title, competency_score FROM employees WHERE id=$1', [empId])
    const emp = empRes.rows[0]
    if (!emp) return res.status(404).json({ error: 'Employee not found.' })
    const assessmentCountRes = await query('SELECT COUNT(*) AS cnt FROM competency_assessments WHERE employee_id = $1', [emp.id])
    const assessmentCount = parseInt(assessmentCountRes.rows[0]?.cnt || '0', 10)
    if (assessmentCount === 0) {
      return res.json({
        notAssessed: true,
        employee: { id: emp.id, name: emp.full_name, department: emp.department, jobTitle: emp.job_title },
        relevantCompetencies: [],
        recommendedResources: [],
      })
    }
    const gapRes = await query(
      `SELECT competency FROM competency_assessments WHERE employee_id=$1 AND score < required_score`,
      [emp.id],
    )
    const gapComps = gapRes.rows.map(r => r.competency)
    if (gapComps.length === 0) {
      return res.json({
        noGaps: true,
        employee: { id: emp.id, name: emp.full_name, department: emp.department, jobTitle: emp.job_title },
        relevantCompetencies: [],
        recommendedResources: [],
      })
    }
    const { rows } = await query(
      `SELECT DISTINCT r.*,
         COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies,
         (SELECT la.status FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_status,
         (SELECT la.progress FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_progress,
         (SELECT la.assessment_score FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_assessment_score,
         (SELECT la.attempts_count FROM learning_assignments la WHERE la.resource_id = r.id AND la.employee_id = $1) AS assignment_attempts,
         EXISTS(SELECT 1 FROM learning_completions lc WHERE lc.resource_id = r.id AND lc.employee_id = $1) AS is_completed
       FROM learning_resources r
       JOIN learning_resource_competencies lrc ON lrc.resource_id = r.id
       WHERE r.is_active = true AND lrc.competency = ANY($2::text[])
       ORDER BY r.created_at DESC`,
      [emp.id, gapComps],
    )
    res.json({
      employee: { id: emp.id, name: emp.full_name, department: emp.department, jobTitle: emp.job_title },
      relevantCompetencies: gapComps,
      recommendedResources: rows,
    })
  } catch (error) { next(error) }
})

// ─── AI Development Plan ──────────────────────────────────────────────────────
router.post('/development-plan', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const targetEmpId = req.body.employeeId || (scope.isEmployee ? scope.employeeId : null)
    if (!targetEmpId) return res.status(400).json({ error: 'Target employee ID is required.' })
    if (!scope.isEmployee) await verifyEmployeeAccess(req.user, targetEmpId)
    const empRes = await query('SELECT id, full_name, department, job_title, competency_score, performance_score FROM employees WHERE id=$1', [targetEmpId])
    const employee = empRes.rows[0]
    if (!employee) return res.status(404).json({ error: 'Employee not found.' })
    const gapRes = await query(
      `SELECT ca.competency, ca.score, ca.required_score, (ca.required_score - ca.score)::int AS gap
       FROM competency_assessments ca
       WHERE ca.employee_id = $1 AND ca.score < ca.required_score
       ORDER BY (ca.required_score - ca.score) DESC`,
      [targetEmpId],
    )
    const resRes = await query(
      `SELECT r.id, r.title, r.category, r.description,
         COALESCE((SELECT array_agg(lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
       FROM learning_resources r WHERE r.is_active = true`,
    )
    const plan = await generateDevelopmentPlan({ employee, gaps: gapRes.rows, resources: resRes.rows })
    await logActivity({
      req, user: req.user, action: 'ai.development_plan', category: 'learning', targetId: targetEmpId,
      description: `Generated AI Skill Gap Development Plan for ${employee.full_name} (${employee.job_title})`,
      details: { gapCount: gapRes.rows.length, department: employee.department },
    })
    res.json({ success: true, plan, gaps: gapRes.rows, generatedAt: new Date().toISOString() })
  } catch (error) { next(error) }
})

// ─── Resource list ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category, search, competency, providerType } = req.query
    const params = []
    let where = 'WHERE r.is_active = true'
    if (category) { params.push(category); where += ` AND r.category = $${params.length}` }
    if (providerType && (providerType === 'internal' || providerType === 'external')) {
      params.push(providerType); where += ` AND r.provider_type = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      where += ` AND (r.title ILIKE $${params.length} OR r.description ILIKE $${params.length} OR r.provider ILIKE $${params.length})`
    }
    if (competency) {
      params.push(competency)
      where += ` AND EXISTS (SELECT 1 FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id AND LOWER(lrc.competency) = LOWER($${params.length}))`
    }
    const { rows } = await query(
      `SELECT r.*,
        COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies,
        (SELECT count(*)::int FROM learning_assignments la WHERE la.resource_id = r.id) AS assigned_count,
        (SELECT count(*)::int FROM learning_completions lc WHERE lc.resource_id = r.id) AS completed_count,
        (jsonb_array_length(COALESCE(r.quiz, '[]'::jsonb)) > 0) AS has_quiz,
        r.pass_threshold
       FROM learning_resources r ${where}
       ORDER BY r.created_at DESC`,
      params,
    )
    res.json({ resources: rows })
  } catch (error) { next(error) }
})

// ─── Create resource — HR only ────────────────────────────────────────────────
router.post('/', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO learning_resources (title, description, category, provider, provider_type, duration_hours, objectives, url, video_url, pdf_url, lesson_content, quiz, pass_threshold, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          input.title, input.description, input.category, input.provider || null,
          input.providerType, input.durationHours ?? null, input.objectives || null,
          input.url || null, input.videoUrl || null, input.pdfUrl || null,
          input.lessonContent || null,
          input.quiz && input.quiz.length > 0 ? JSON.stringify(input.quiz) : null,
          input.passThreshold,
          req.user.sub,
        ],
      )
      const resource = rows[0]
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [resource.id, competency])
      }
      return { ...resource, competencies: [...new Set(input.competencies)] }
    })
    await logActivity({ req, user: req.user, action: 'learning.resource_create', category: 'learning', targetId: result.id, description: `${req.user.name} created learning resource "${result.title}"` })
    res.status(201).json({ resource: result })
  } catch (error) { next(error) }
})

// ─── Update resource — HR only ────────────────────────────────────────────────
router.patch('/:id', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `UPDATE learning_resources SET title=$1, description=$2, category=$3, provider=$4, provider_type=$5,
           duration_hours=$6, objectives=$7, url=$8, video_url=$9, pdf_url=$10, lesson_content=$11,
           quiz=$12, pass_threshold=$13, updated_at=NOW()
         WHERE id=$14 AND is_active=true RETURNING *`,
        [
          input.title, input.description, input.category, input.provider || null,
          input.providerType, input.durationHours ?? null, input.objectives || null,
          input.url || null, input.videoUrl || null, input.pdfUrl || null,
          input.lessonContent || null,
          input.quiz && input.quiz.length > 0 ? JSON.stringify(input.quiz) : null,
          input.passThreshold,
          req.params.id,
        ],
      )
      if (!rows[0]) throw Object.assign(new Error('Active learning resource not found.'), { status: 404 })
      await client.query('DELETE FROM learning_resource_competencies WHERE resource_id=$1', [req.params.id])
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [req.params.id, competency])
      }
      return { ...rows[0], competencies: [...new Set(input.competencies)] }
    })
    await logActivity({ req, user: req.user, action: 'learning.resource_update', category: 'learning', targetId: req.params.id, description: `${req.user.name} updated learning resource "${result.title}"` })
    res.json({ resource: result })
  } catch (error) { next(error) }
})

// ─── Archive resource — HR only ───────────────────────────────────────────────
router.delete('/:id', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE learning_resources SET is_active=false, updated_at=NOW() WHERE id=$1 AND is_active=true RETURNING id', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Active learning resource not found.' })
    await logActivity({ req, user: req.user, action: 'learning.resource_archive', category: 'learning', targetId: req.params.id, description: `${req.user.name} archived learning resource` })
    res.json({ archived: true })
  } catch (error) { next(error) }
})

// ─── Assign a resource to employee(s) — HR or supervisor ─────────────────────
router.post('/assign', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const input = assignSchema.parse(req.body)
    for (const empId of input.employeeIds) await verifyEmployeeAccess(req.user, empId)
    const result = await transaction(async client => {
      const resourceCheck = await client.query('SELECT id FROM learning_resources WHERE id=$1 AND is_active=true', [input.resourceId])
      if (!resourceCheck.rows[0]) throw Object.assign(new Error('Learning resource is not available.'), { status: 404 })
      const people = await client.query('SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[]) AND is_active=true', [input.employeeIds])
      if (people.rowCount !== input.employeeIds.length) throw Object.assign(new Error('One or more selected employees are unavailable.'), { status: 400 })
      const created = []
      for (const employee of people.rows) {
        const inserted = await client.query(
          `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, due_date, status, progress)
           VALUES ($1,$2,$3,$4,'not_started',0)
           ON CONFLICT (resource_id, employee_id) DO UPDATE
             SET assigned_by = EXCLUDED.assigned_by,
                 due_date    = EXCLUDED.due_date,
                 status      = 'not_started',
                 progress    = 0,
                 started_at  = NULL,
                 material_completed = false,
                 material_completed_at = NULL,
                 assessment_status = 'not_taken',
                 assessment_score = NULL,
                 attempts_count = 0,
                 last_attempt_at = NULL,
                 is_overridden = false,
                 override_reason = NULL,
                 overridden_by = NULL,
                 overridden_at = NULL,
                 progress_breakdown = '{}'::jsonb
           RETURNING *`,
          [input.resourceId, employee.id, req.user.sub, input.dueDate || null],
        )
        created.push(inserted.rows[0])
        await client.query(
          `UPDATE employees
           SET learning_progress = (SELECT COALESCE(ROUND(AVG(progress)), 0) FROM learning_assignments WHERE employee_id = $1),
               updated_at = NOW()
           WHERE id = $1`,
          [employee.id],
        )
      }
      return created
    })
    await logActivity({ req, user: req.user, action: 'learning.assign', category: 'learning', targetId: input.resourceId, description: `${req.user.name} assigned learning resource to ${result.length} employee(s)`, details: { employeeIds: input.employeeIds, dueDate: input.dueDate || null } })
    res.status(201).json({ assignments: result })
  } catch (error) { next(error) }
})

// ─── List assignments ─────────────────────────────────────────────────────────
router.get('/assignments', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE 1=1'
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND la.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT la.*,
         r.title AS resource_title, r.category, r.provider, r.provider_type, r.duration_hours,
         r.pass_threshold,
         (jsonb_array_length(COALESCE(r.quiz, '[]'::jsonb)) > 0) AS has_quiz,
         e.full_name AS employee_name, e.department,
         lc.id IS NOT NULL AS is_completion_recorded,
         lc.completed_at, lc.assessment_result,
         COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
       FROM learning_assignments la
       JOIN learning_resources r ON r.id = la.resource_id
       JOIN employees e ON e.id = la.employee_id
       LEFT JOIN learning_completions lc ON lc.resource_id = la.resource_id AND lc.employee_id = la.employee_id
       ${where}
       ORDER BY la.assigned_at DESC`,
      params,
    )
    const enriched = rows.map(a => ({
      ...a,
      is_completed: a.status === 'completed',
      fromCompetencyGap: (a.competencies || []).length > 0,
    }))
    res.json({ assignments: enriched })
  } catch (error) { next(error) }
})

// ─── Track material access (employee starts/views course content) ─────────────
// Called when an employee opens the CourseContentViewer.
// Sets started_at if not already set and transitions status to in_progress.
router.post('/assignments/:id/access', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    await verifyEmployeeAccess(req.user, assignment.employee_id)

    // Fetch resource pass_threshold
    const resRow = await query('SELECT pass_threshold FROM learning_resources WHERE id=$1', [assignment.resource_id])
    const passThreshold = Number(resRow.rows[0]?.pass_threshold || 75)

    // Only update if not already started or completed
    if (!assignment.started_at) {
      await query(
        `UPDATE learning_assignments
         SET started_at = NOW(),
             last_accessed_at = NOW()
         WHERE id = $1`,
        [assignment.id],
      )
    } else {
      await query(
        `UPDATE learning_assignments SET last_accessed_at = NOW() WHERE id = $1`,
        [assignment.id],
      )
    }

    // Reload and sync progress
    const { rows: fresh } = await query('SELECT * FROM learning_assignments WHERE id=$1', [assignment.id])
    const synced = await transaction(async client => {
      return syncAssignmentProgress(client, fresh[0], passThreshold)
    })

    await logActivity({ req, user: req.user, action: 'learning.material_access', category: 'learning', targetId: assignment.id, description: `${req.user.name} accessed learning material`, details: { resourceId: assignment.resource_id } })
    res.json({ accessed: true, ...synced })
  } catch (error) { next(error) }
})

// ─── Mark material as completed (employee finished reading/watching) ───────────
// Called when employee explicitly signals they have finished the material.
// This is NOT the same as completing the course — assessment still required.
router.post('/assignments/:id/complete-material', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    await verifyEmployeeAccess(req.user, assignment.employee_id)

    const resRow = await query('SELECT pass_threshold FROM learning_resources WHERE id=$1', [assignment.resource_id])
    const passThreshold = Number(resRow.rows[0]?.pass_threshold || 75)

    await query(
      `UPDATE learning_assignments
       SET material_completed = true,
           material_completed_at = NOW(),
           last_accessed_at = NOW(),
           started_at = COALESCE(started_at, NOW())
       WHERE id = $1`,
      [assignment.id],
    )

    const { rows: fresh } = await query('SELECT * FROM learning_assignments WHERE id=$1', [assignment.id])
    const synced = await transaction(async client => {
      const result = await syncAssignmentProgress(client, fresh[0], passThreshold)
      return result
    })

    await logActivity({ req, user: req.user, action: 'learning.material_complete', category: 'learning', targetId: assignment.id, description: `${req.user.name} marked learning material as completed`, details: { resourceId: assignment.resource_id } })
    res.json({ materialCompleted: true, ...synced })
  } catch (error) { next(error) }
})

// ─── Submit assessment answers — auto-scored ──────────────────────────────────
// Employee submits quiz answers; server scores them automatically.
router.post('/assignments/:id/submit-assessment', async (req, res, next) => {
  try {
    const input = assessmentSubmitSchema.parse(req.body)

    const { rows } = await query(
      `SELECT la.*, r.quiz, r.pass_threshold, r.title AS resource_title
       FROM learning_assignments la
       JOIN learning_resources r ON r.id = la.resource_id
       WHERE la.id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    await verifyEmployeeAccess(req.user, assignment.employee_id)

    // Only employees (or HR in override context) can submit
    const scope = await getScopeFilter(req.user)
    if (!scope.isEmployee && req.user.role !== 'hr' && req.user.role !== 'operations_manager') {
      return res.status(403).json({ error: 'Only the assigned employee can submit assessment answers.' })
    }

    // Require material to have been accessed first
    if (!assignment.started_at) {
      return res.status(400).json({ error: 'You must access the course material before taking the assessment.' })
    }

    const quiz = Array.isArray(assignment.quiz) ? assignment.quiz : []
    if (quiz.length === 0) {
      return res.status(400).json({ error: 'This course has no assessment questions configured.' })
    }

    const passThreshold = Number(assignment.pass_threshold || 75)

    // Auto-score
    let correct = 0
    const scoredAnswers = input.answers.map(ans => {
      const question = quiz.find(q => q.id === ans.questionId) || quiz[0]
      if (!question) return { questionId: ans.questionId, selectedIndex: ans.selectedIndex, correctIndex: null, isCorrect: false }
      const isCorrect = ans.selectedIndex === question.correctIndex
      if (isCorrect) correct++
      return {
        questionId: ans.questionId,
        selectedIndex: ans.selectedIndex,
        correctIndex: question.correctIndex,
        isCorrect,
        explanation: question.explanation || '',
      }
    })

    const totalQuestions = quiz.length
    const score = Math.round((correct / totalQuestions) * 100)
    const passed = score >= passThreshold
    const attemptNumber = Number(assignment.attempts_count || 0) + 1

    const result = await transaction(async client => {
      // Record attempt
      await client.query(
        `INSERT INTO learning_assessment_attempts
           (assignment_id, resource_id, employee_id, score, total_questions, correct_answers, passed, answers, attempt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          assignment.id, assignment.resource_id, assignment.employee_id,
          score, totalQuestions, correct, passed, JSON.stringify(scoredAnswers), attemptNumber,
        ],
      )

      // Update assignment assessment fields
      const { rows: updatedRows } = await client.query(
        `UPDATE learning_assignments
         SET assessment_status   = $1,
             assessment_score    = $2,
             attempts_count      = $3,
             last_attempt_at     = NOW(),
             started_at          = COALESCE(started_at, NOW()),
             material_completed  = COALESCE(material_completed, false)
         WHERE id = $4
         RETURNING *`,
        [passed ? 'passed' : 'failed', score, attemptNumber, assignment.id],
      )

      const synced = await syncAssignmentProgress(client, updatedRows[0], passThreshold)

      // If passed, record official completion
      if (passed) {
        await handleCompletion(client, updatedRows[0], req.user.sub, { score, correct, totalQuestions, attemptNumber })
      }

      return { ...synced, score, correct, totalQuestions, passed, attemptNumber, scoredAnswers }
    })

    await logActivity({
      req, user: req.user, action: 'learning.assessment_submit', category: 'learning',
      targetId: assignment.id,
      description: `${req.user.name} submitted assessment for "${assignment.resource_title}" — Score: ${score}% (${passed ? 'PASSED' : 'FAILED'}, attempt #${attemptNumber})`,
      details: { score, correct, totalQuestions, passed, attemptNumber, resourceId: assignment.resource_id },
    })

    res.json({
      assessmentComplete: true,
      score,
      correct,
      totalQuestions,
      passed,
      passThreshold,
      attemptNumber,
      status: result.status,
      progress: result.progress,
      progressBreakdown: result.progressBreakdown,
      scoredAnswers,
    })
  } catch (error) { next(error) }
})

// ─── Get assessment questions for a course (masked — no correctIndex exposed) ──
// Returns questions without revealing correct answers.
router.get('/assignments/:id/assessment', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT la.id, la.employee_id, la.resource_id, la.status, la.started_at,
              la.material_completed, la.attempts_count, la.assessment_status, la.assessment_score,
              r.quiz, r.pass_threshold, r.title AS resource_title
       FROM learning_assignments la
       JOIN learning_resources r ON r.id = la.resource_id
       WHERE la.id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    await verifyEmployeeAccess(req.user, assignment.employee_id)

    if (!assignment.started_at) {
      return res.status(400).json({ error: 'Access the course material before attempting the assessment.', notStarted: true })
    }

    const quiz = Array.isArray(assignment.quiz) ? assignment.quiz : []
    // Mask correct answers for employee view
    const scope = await getScopeFilter(req.user)
    const isHrAdmin = !scope.isEmployee
    const questions = quiz.map((q, idx) => ({
      id: q.id || `q${idx + 1}`,
      question: q.question,
      options: q.options,
      // Only expose correctIndex to HR/Admin for monitoring
      ...(isHrAdmin ? { correctIndex: q.correctIndex, explanation: q.explanation } : {}),
    }))

    // Get attempt history
    const { rows: attempts } = await query(
      `SELECT attempt_number, score, passed, created_at
       FROM learning_assessment_attempts
       WHERE assignment_id = $1
       ORDER BY attempt_number DESC`,
      [assignment.id],
    )

    res.json({
      assignmentId: assignment.id,
      resourceTitle: assignment.resource_title,
      passThreshold: Number(assignment.pass_threshold || 75),
      questions,
      totalQuestions: questions.length,
      currentStatus: assignment.assessment_status,
      currentScore: assignment.assessment_score,
      attemptsCount: assignment.attempts_count,
      materialCompleted: assignment.material_completed,
      attemptHistory: attempts,
    })
  } catch (error) { next(error) }
})

// ─── HR Override (authorized) ─────────────────────────────────────────────────
// HR can override status/progress in exceptional cases.
// EVERY override is recorded in the audit log.
router.post('/assignments/:id/override', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const input = overrideSchema.parse(req.body)
    const { rows } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]

    const prevStatus = assignment.status
    const prevProgress = assignment.progress

    const { rows: updated } = await query(
      `UPDATE learning_assignments
       SET status          = $1,
           progress        = $2,
           is_overridden   = true,
           override_reason = $3,
           overridden_by   = $4,
           overridden_at   = NOW(),
           progress_breakdown = jsonb_set(
             COALESCE(progress_breakdown, '{}'::jsonb),
             '{overrideNote}',
             $5::jsonb
           )
       WHERE id = $6
       RETURNING *`,
      [
        input.status,
        input.progress,
        input.reason,
        req.user.sub,
        JSON.stringify(`HR Override by ${req.user.name} — ${input.reason}`),
        assignment.id,
      ],
    )

    // If overriding to completed, write a completion record
    if (input.status === 'completed') {
      await query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (resource_id, employee_id) DO UPDATE
           SET assessment_result = EXCLUDED.assessment_result, completed_at = NOW()`,
        [
          assignment.resource_id, assignment.employee_id, assignment.id,
          JSON.stringify({ hrOverride: true, reason: input.reason, overriddenBy: req.user.name }),
          req.user.sub,
        ],
      )
    }

    // Update employee aggregate
    await query(
      `UPDATE employees
       SET learning_progress = (SELECT COALESCE(ROUND(AVG(progress)), 0) FROM learning_assignments WHERE employee_id = $1),
           updated_at = NOW()
       WHERE id = $1`,
      [assignment.employee_id],
    )

    // MANDATORY audit log for all overrides
    await logActivity({
      req, user: req.user, action: 'learning.hr_override', category: 'learning',
      targetId: assignment.id,
      description: `HR Override by ${req.user.name}: assignment status changed from "${prevStatus}" to "${input.status}" (progress: ${prevProgress}% → ${input.progress}%)`,
      details: {
        assignmentId: assignment.id,
        resourceId: assignment.resource_id,
        employeeId: assignment.employee_id,
        previousStatus: prevStatus,
        previousProgress: prevProgress,
        newStatus: input.status,
        newProgress: input.progress,
        reason: input.reason,
        overriddenBy: req.user.sub,
      },
    })

    res.json({ overridden: true, assignment: updated[0] })
  } catch (error) { next(error) }
})

// ─── Get assessment attempt history for HR monitoring ─────────────────────────
router.get('/assignments/:id/attempts', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const { rows: assignment } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!assignment[0]) return res.status(404).json({ error: 'Assignment not found.' })
    await verifyEmployeeAccess(req.user, assignment[0].employee_id)
    const { rows: attempts } = await query(
      `SELECT laa.*, u.full_name AS submitted_by_name
       FROM learning_assessment_attempts laa
       LEFT JOIN employees u ON u.id = laa.employee_id
       WHERE laa.assignment_id = $1
       ORDER BY laa.attempt_number ASC`,
      [req.params.id],
    )
    res.json({ attempts, assignment: assignment[0] })
  } catch (error) { next(error) }
})

// ─── Record completion + assessment — HR or supervisor (legacy manual) ─────────
// Still available for exceptional cases (e.g., external courses with no quiz).
// Always audit-logged.
router.post('/completions', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const input = completionSchema.parse(req.body)
    await verifyEmployeeAccess(req.user, input.employeeId)
    const result = await transaction(async client => {
      const assignment = await client.query(
        'SELECT id FROM learning_assignments WHERE resource_id=$1 AND employee_id=$2',
        [input.resourceId, input.employeeId],
      )
      await client.query('DELETE FROM learning_completions WHERE resource_id=$1 AND employee_id=$2', [input.resourceId, input.employeeId])
      const { rows } = await client.query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.resourceId, input.employeeId, assignment.rows[0]?.id || null, JSON.stringify({ ...input.assessment, hrVerified: true }), req.user.sub],
      )
      if (assignment.rows[0]) {
        await client.query(
          `UPDATE learning_assignments
           SET progress=100, status='completed',
               material_completed=true, assessment_status='passed', assessment_score=100,
               is_overridden=true, override_reason='HR manual completion verification',
               overridden_by=$1, overridden_at=NOW()
           WHERE id=$2`,
          [req.user.sub, assignment.rows[0].id],
        )
      }
      const linkedComps = await client.query('SELECT competency FROM learning_resource_competencies WHERE resource_id=$1', [input.resourceId])
      for (const { competency } of linkedComps.rows) {
        await client.query(
          `UPDATE competency_assessments
           SET score = LEAST(100, GREATEST(required_score, score + 15)), source = 'learning_completion', updated_at = NOW()
           WHERE employee_id = $1 AND LOWER(competency) = LOWER($2)`,
          [input.employeeId, competency],
        )
      }
      await client.query(
        `UPDATE employees
         SET competency_score = (SELECT COALESCE(ROUND(AVG(score)), 80) FROM competency_assessments WHERE employee_id = $1),
             learning_progress = (SELECT COALESCE(ROUND(AVG(progress)), 100) FROM learning_assignments WHERE employee_id = $1)
         WHERE id = $1`,
        [input.employeeId],
      )
      return rows[0]
    })
    await logActivity({ req, user: req.user, action: 'learning.completion', category: 'learning', targetId: input.employeeId, description: `${req.user.name} verified completion of learning resource for employee (HR manual)`, details: { resourceId: input.resourceId, employeeId: input.employeeId } })
    res.status(201).json({ completion: result })
  } catch (error) { next(error) }
})

// ─── List completions ─────────────────────────────────────────────────────────
router.get('/completions', async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE 1=1'
    if (scope.isEmployee) {
      params.push(scope.employeeId)
      where += ` AND lc.employee_id = $${params.length}`
    } else if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(
      `SELECT lc.*, r.title AS resource_title, r.category, r.provider, r.provider_type,
         e.full_name AS employee_name, e.department,
         la.assessment_score, la.attempts_count, la.progress_breakdown,
         la.is_overridden, la.override_reason
       FROM learning_completions lc
       JOIN learning_resources r ON r.id = lc.resource_id
       JOIN employees e ON e.id = lc.employee_id
       LEFT JOIN learning_assignments la ON la.id = lc.assignment_id
       ${where}
       ORDER BY lc.completed_at DESC`,
      params,
    )
    res.json({ completions: rows })
  } catch (error) { next(error) }
})

export default router
