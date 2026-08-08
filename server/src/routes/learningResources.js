import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()

// ---------------------------------------------------------------------------
// Learning Resource / Course Library API.
//
// Clearly separates:
//   - COURSE/RESOURCE info   (learning_resources)
//   - competency association (learning_resource_competencies)
//   - ASSIGNMENT             (learning_assignments)
//   - SELF-REPORTED PROGRESS (learning_assignments.progress / status)
//   - COMPLETION/ASSESSMENT  (learning_completions)  <-- ONLY source of truth
//                                                       for "completed"
//
// Employees update their own progress (%) and a self-reported status
// (not_started / studying / completed / need_help). HR/supervisors can see the
// live status badge and still officially VERIFY/RECORD completion via
// learning_completions.
// ---------------------------------------------------------------------------

const resourceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(3000),
  category: z.string().min(2).max(120),
  provider: z.string().max(200).optional().default(''),
  providerType: z.enum(['internal', 'external']).default('internal'),
  durationHours: z.coerce.number().nonnegative().max(1000).nullable().optional(),
  objectives: z.string().max(4000).optional().default(''),
  url: z.string().max(500).optional().default(''),
  competencies: z.array(z.string().min(1).max(120)).max(50).default([]),
})

const assignSchema = z.object({
  resourceId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  dueDate: z.string().date().nullable().optional(),
})

// Self-reported progress + status. status is the employee's own flag; progress
// is the employee-driven 0-100 slider.
const progressSchema = z.object({
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['not_started', 'studying', 'completed', 'need_help']).optional(),
})

const completionSchema = z.object({
  resourceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  assessment: z.record(z.unknown()).default({}),
})

router.use(authenticate)

// Competencies available for association (enumerated from workflow config +
// any already-used competency tags).
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

// Skill-gap detection — real per-competency data from competency_assessments.
// Returns each gap (current score < required score) with the employee's
// aggregate competency score and any learning resources that already carry the
// matching competency tag. Accessible to HR, supervisors and the employee
// themselves (their own gaps only).
router.get('/skill-gaps', async (req, res, next) => {
  try {
    const { employeeId } = req.query
    let where = 'WHERE 1=1'
    const params = []
    // Employees may only view their own gaps.
    if (req.user.role === 'employee') {
      params.push(req.user.employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    } else if (employeeId) {
      params.push(employeeId)
      where += ` AND ca.employee_id = $${params.length}`
    }
    const { rows } = await query(
      `SELECT ca.employee_id, ca.competency, ca.score, ca.required_score,
              (ca.required_score - ca.score)::int AS gap,
              e.full_name AS employee_name, e.job_title, e.department,
              e.competency_score AS aggregate_competency_score
       FROM competency_assessments ca
       JOIN employees e ON e.id = ca.employee_id
       ${where}
       ORDER BY (ca.required_score - ca.score) DESC`,
      params,
    )
    const gaps = rows
      .filter(r => Number(r.score) < Number(r.required_score))
      .map(r => ({ ...r, score: Number(r.score), required_score: Number(r.required_score), gap: Number(r.gap) }))

    // Attach matching library courses per gap competency (already-existing
    // resources tagged with that competency).
    const comps = [...new Set(gaps.map(g => g.competency))]
    const courseResult = comps.length
      ? await query(
          `SELECT r.id, r.title, r.category, r.provider, r.duration_hours, r.description,
                  COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
           FROM learning_resources r
           WHERE r.is_active = true
             AND r.id IN (SELECT resource_id FROM learning_resource_competencies WHERE competency = ANY($1::text[]))
           ORDER BY r.title`,
          [comps],
        )
      : { rows: [] }
    const byCompetency = {}
    for (const course of courseResult.rows) {
      for (const comp of course.competencies || []) {
        byCompetency[comp] = byCompetency[comp] || []
        byCompetency[comp].push(course)
      }
    }
    for (const gap of gaps) gap.courses = byCompetency[gap.competency] || []

    res.json({ gaps, employeeId: req.user.employeeId })
  } catch (error) { next(error) }
})

// List resources — all roles. Supports filtering.
router.get('/', async (req, res, next) => {
  try {
    const { category, providerType, competency, includeArchived } = req.query
    const params = []
    let where = 'WHERE r.is_active = true'
    if (includeArchived === 'true') where = 'WHERE 1=1'
    if (category) { params.push(category); where += ` AND r.category = $${params.length}` }
    if (providerType) { params.push(providerType); where += ` AND r.provider_type = $${params.length}` }
    if (competency) {
      params.push(competency)
      where += ` AND r.id IN (SELECT resource_id FROM learning_resource_competencies WHERE competency = $${params.length})`
    }
    const { rows } = await query(
      `SELECT r.*,
        COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies,
        (SELECT count(*)::int FROM learning_assignments la WHERE la.resource_id = r.id) AS assigned_count,
        (SELECT count(*)::int FROM learning_completions lc WHERE lc.resource_id = r.id) AS completed_count
       FROM learning_resources r ${where}
       ORDER BY r.created_at DESC`,
      params,
    )
    res.json({ resources: rows })
  } catch (error) { next(error) }
})

// Create resource — HR only.
router.post('/', authorize('hr'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO learning_resources (title, description, category, provider, provider_type, duration_hours, objectives, url, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [input.title, input.description, input.category, input.provider || null, input.providerType, input.durationHours ?? null, input.objectives || null, input.url || null, req.user.sub],
      )
      const resource = rows[0]
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [resource.id, competency])
      }
      return { ...resource, competencies: [...new Set(input.competencies)] }
    })
    res.status(201).json({ resource: result })
  } catch (error) { next(error) }
})

// Update resource — HR only.
router.patch('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const input = resourceSchema.parse(req.body)
    const result = await transaction(async client => {
      const { rows } = await client.query(
        `UPDATE learning_resources SET title=$1, description=$2, category=$3, provider=$4, provider_type=$5,
           duration_hours=$6, objectives=$7, url=$8, updated_at=NOW()
         WHERE id=$9 AND is_active=true RETURNING *`,
        [input.title, input.description, input.category, input.provider || null, input.providerType, input.durationHours ?? null, input.objectives || null, input.url || null, req.params.id],
      )
      if (!rows[0]) throw Object.assign(new Error('Active learning resource not found.'), { status: 404 })
      await client.query('DELETE FROM learning_resource_competencies WHERE resource_id=$1', [req.params.id])
      for (const competency of [...new Set(input.competencies)]) {
        await client.query('INSERT INTO learning_resource_competencies (resource_id, competency) VALUES ($1,$2)', [req.params.id, competency])
      }
      return { ...rows[0], competencies: [...new Set(input.competencies)] }
    })
    res.json({ resource: result })
  } catch (error) { next(error) }
})

// Archive (soft-delete) resource — HR only.
router.delete('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE learning_resources SET is_active=false, updated_at=NOW() WHERE id=$1 AND is_active=true RETURNING id', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Active learning resource not found.' })
    res.json({ archived: true })
  } catch (error) { next(error) }
})

// Assign a resource to employee(s) — HR or supervisor.
router.post('/assign', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = assignSchema.parse(req.body)
    const result = await transaction(async client => {
      const resourceCheck = await client.query('SELECT id FROM learning_resources WHERE id=$1 AND is_active=true', [input.resourceId])
      if (!resourceCheck.rows[0]) throw Object.assign(new Error('Learning resource is not available.'), { status: 404 })
      const people = await client.query('SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[]) AND is_active=true', [input.employeeIds])
      if (people.rowCount !== input.employeeIds.length) throw Object.assign(new Error('One or more selected employees are unavailable.'), { status: 400 })
      const created = []
      for (const employee of people.rows) {
        const inserted = await client.query(
          `INSERT INTO learning_assignments (resource_id, employee_id, assigned_by, due_date)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (resource_id, employee_id) DO UPDATE SET assigned_by=EXCLUDED.assigned_by, due_date=EXCLUDED.due_date, status='not_started', progress=0
           RETURNING *`,
          [input.resourceId, employee.id, req.user.sub, input.dueDate || null],
        )
        created.push(inserted.rows[0])
      }
      return created
    })
    res.status(201).json({ assignments: result })
  } catch (error) { next(error) }
})

// List assignments. Employees see only their own.
router.get('/assignments', async (req, res, next) => {
  try {
    const params = []
    let where = 'WHERE 1=1'
    if (req.user.role === 'employee') {
      params.push(req.user.employeeId)
      where += ` AND la.employee_id = $${params.length}`
    }
const { rows } = await query(
      `SELECT la.*, r.title AS resource_title, r.category, r.provider, r.provider_type, r.duration_hours,
        e.full_name AS employee_name, e.department,
        (lc.id IS NOT NULL) AS is_completed, lc.completed_at, lc.assessment_result,
        COALESCE((SELECT array_agg(lrc.competency ORDER BY lrc.competency) FROM learning_resource_competencies lrc WHERE lrc.resource_id = r.id), '{}') AS competencies
       FROM learning_assignments la
       JOIN learning_resources r ON r.id = la.resource_id
       JOIN employees e ON e.id = la.employee_id
       LEFT JOIN learning_completions lc ON lc.resource_id = la.resource_id AND lc.employee_id = la.employee_id
       ${where}
       ORDER BY la.assigned_at DESC`,
      params,
    )
    // Tag assignments that were created from a competency gap (their resource
    // carries a competency tag, meaning it was linked via the gap workflow).
    res.json({ assignments: rows.map(a => ({ ...a, fromCompetencyGap: (a.competencies || []).length > 0 })) })
  } catch (error) { next(error) }
})

// Update self-reported progress + status — HR, supervisor, or the employee
// themselves can update their own assignment.
router.patch('/assignments/:id/progress', async (req, res, next) => {
  try {
    const input = progressSchema.parse(req.body)
    if (input.progress === undefined && input.status === undefined) {
      return res.status(400).json({ error: 'Provide at least a progress value or a status.' })
    }
    const { rows } = await query('SELECT * FROM learning_assignments WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found.' })
    const assignment = rows[0]
    if (req.user.role === 'employee' && assignment.employee_id !== req.user.employeeId) {
      return res.status(403).json({ error: 'You can only update your own assignment.' })
    }
    // Derive status from progress if status not explicitly provided, so the
    // slider alone keeps the status badge sensible.
    let status = input.status
    if (status === undefined) {
      const progress = input.progress !== undefined ? input.progress : Number(assignment.progress || 0)
      status = progress >= 100 ? 'completed' : progress > 0 ? 'studying' : 'not_started'
    }
    let progress = input.progress
    if (progress === undefined) progress = Number(assignment.progress || 0)
    const updated = await query(
      'UPDATE learning_assignments SET progress=$1, status=$2 WHERE id=$3 RETURNING *',
      [progress, status, req.params.id],
    )
    res.json({ assignment: updated.rows[0] })
  } catch (error) { next(error) }
})

// Record completion + assessment — HR or supervisor. This is the ONLY place
// an employee is marked as having completed a course (official verification).
router.post('/completions', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = completionSchema.parse(req.body)
    const result = await transaction(async client => {
      const assignment = await client.query(
        'SELECT id FROM learning_assignments WHERE resource_id=$1 AND employee_id=$2',
        [input.resourceId, input.employeeId],
      )
      await client.query('DELETE FROM learning_completions WHERE resource_id=$1 AND employee_id=$2', [input.resourceId, input.employeeId])
      const { rows } = await client.query(
        `INSERT INTO learning_completions (resource_id, employee_id, assignment_id, assessment_result, verified_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.resourceId, input.employeeId, assignment.rows[0]?.id || null, JSON.stringify(input.assessment), req.user.sub],
      )
      if (assignment.rows[0]) {
        await client.query("UPDATE learning_assignments SET progress=100, status='completed' WHERE id=$1", [assignment.rows[0].id])
      }
      return rows[0]
    })
    res.status(201).json({ completion: result })
  } catch (error) { next(error) }
})

// List completions (confirmed records only).
router.get('/completions', async (req, res, next) => {
  try {
    const params = []
    let where = 'WHERE 1=1'
    if (req.user.role === 'employee') {
      params.push(req.user.employeeId)
      where += ` AND lc.employee_id = $${params.length}`
    }
    const { rows } = await query(
      `SELECT lc.*, r.title AS resource_title, r.category, r.provider, r.provider_type,
        e.full_name AS employee_name, e.department
       FROM learning_completions lc
       JOIN learning_resources r ON r.id = lc.resource_id
       JOIN employees e ON e.id = lc.employee_id
       ${where}
       ORDER BY lc.completed_at DESC`,
      params,
    )
    res.json({ completions: rows })
  } catch (error) { next(error) }
})

export default router
