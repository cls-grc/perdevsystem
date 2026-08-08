import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { stagesFor, nextStage, returnToStage, canActOnStage } from '../workflow.js'
import { authenticate, authorize } from '../middleware.js'
import { saveMetricsForWorkflow, generateOnDemand, getReportsForWorkflow, calculateMetrics } from '../services/aiReports.js'

const router = Router()
const createSchema = z.object({ module: z.enum(['performance','competency','learning','training','succession','recognition']), subjectEmployeeId: z.string().uuid().nullable().optional(), title: z.string().min(3).max(140), dueDate: z.string().datetime().nullable().optional(), metadata: z.record(z.unknown()).default({}) })
const advanceSchema = z.object({ note: z.string().max(2000).optional(), data: z.record(z.unknown()).default({}), scores: z.object({ performanceScore: z.number().min(0).max(100).optional(), competencyScore: z.number().min(0).max(100).optional(), learningProgress: z.number().min(0).max(100).optional() }).optional() })
const noteSchema = z.object({ note: z.string().min(1).max(2000), data: z.record(z.unknown()).default({}) })
const returnSchema = z.object({ targetStage: z.string().optional(), note: z.string().max(2000).optional(), data: z.record(z.unknown()).default({}) })
const cancelSchema = z.object({ reason: z.string().min(1).max(2000), data: z.record(z.unknown()).default({}) })
const dueDateSchema = z.object({ dueDate: z.string().datetime() })
const overdueQuerySchema = z.object({ days: z.coerce.number().int().positive().default(3) })
async function notifyNextOwners(client, workflow, destination) {
  const employeeOnly = destination.roles.length === 1 && destination.roles[0] === 'employee'
  const recipients = employeeOnly
    ? await client.query('SELECT id FROM users WHERE employee_id=$1 AND is_active=true', [workflow.subject_employee_id])
    : await client.query('SELECT id FROM users WHERE role = ANY($1::user_role[]) AND is_active=true', [destination.roles])
  const title = `${workflow.module[0].toUpperCase()}${workflow.module.slice(1)} action required`
  const message = `${destination.label} is ready for your action: ${workflow.title}.`
  for (const recipient of recipients.rows) await client.query('INSERT INTO notifications(user_id, workflow_id, title, message) VALUES($1,$2,$3,$4)', [recipient.id, workflow.id, title, message])
}
router.use(authenticate)

router.get('/definitions', (_req, res) => res.json({ workflows: Object.fromEntries(Object.entries({ performance: stagesFor('performance'), competency: stagesFor('competency'), learning: stagesFor('learning'), training: stagesFor('training'), succession: stagesFor('succession'), recognition: stagesFor('recognition') }).map(([module, stages]) => [module, stages.map(([key, label, roles]) => ({ key, label, roles }))])) }))

router.get('/subjects', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, full_name, department, job_title FROM employees WHERE is_active=true ORDER BY full_name')
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    const { module, status = 'active', page = '1', limit = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))
    const offset = (pageNum - 1) * limitNum
    const params = []; let where = 'WHERE w.status = $1'; params.push(status)
    if (module) { params.push(module); where += ` AND w.module = $${params.length}` }
    if (req.user.role === 'employee') { params.push(req.user.employeeId); where += ` AND w.subject_employee_id = $${params.length}` }
    const countResult = await query(`SELECT count(*)::int AS total FROM workflows w ${where}`, params)
    const total = countResult.rows[0]?.total || 0
    params.push(limitNum, offset)
    const { rows } = await query(`SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id = w.subject_employee_id ${where} ORDER BY w.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    res.json({ workflows: rows, total, page: pageNum, limit: limitNum })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body); const [initialStage] = stagesFor(input.module)
    if (!initialStage[2].includes(req.user.role)) return res.status(403).json({ error: 'Your role cannot start this workflow.' })
    const subjectEmployeeId = input.subjectEmployeeId || (req.user.role === 'employee' ? req.user.employeeId : null)
    const { rows } = await query('INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, due_date, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [input.module, input.title, subjectEmployeeId, initialStage[0], req.user.sub, input.dueDate || null, input.metadata])
    await query('INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, details) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, initialStage[0], 'created', req.user.sub, input.metadata])
    res.status(201).json({ workflow: rows[0] })
  } catch (error) { next(error) }
})

const assignGapSchema = z.object({
  subjectEmployeeId: z.string().uuid(),
  courseTitle: z.string().min(2).max(140),
  competencyName: z.string().optional(),
  gapScore: z.number().optional(),
})

router.post('/assign-learning-gap', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = assignGapSchema.parse(req.body)
    const [initialStage] = stagesFor('learning')
    const title = `Learning Path: ${input.courseTitle}`
    const metadata = {
      courseTitle: input.courseTitle,
      assignedFromCompetencyGap: true,
      competencyName: input.competencyName || '',
      gapScore: input.gapScore || 0,
      assignedBy: req.user.sub,
    }
    const { rows } = await query(
      'INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      ['learning', title, input.subjectEmployeeId, initialStage[0], req.user.sub, metadata]
    )
    await query(
      'INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details) VALUES ($1,$2,$3,$4,$5,$6)',
      [rows[0].id, initialStage[0], 'created', req.user.sub, `Assigned to resolve skill gap in ${input.competencyName || 'Competency'}`, metadata]
    )
    res.status(201).json({ workflow: rows[0], assigned: true })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id=w.subject_employee_id WHERE w.id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Workflow not found.' })
    if (req.user.role === 'employee' && rows[0].subject_employee_id !== req.user.employeeId) return res.status(403).json({ error: 'You cannot view this workflow.' })
    const events = await query('SELECT we.*, u.full_name AS actor_name FROM workflow_events we JOIN users u ON u.id=we.actor_id WHERE workflow_id=$1 ORDER BY created_at ASC', [req.params.id])
    res.json({ workflow: rows[0], events: events.rows, stages: stagesFor(rows[0].module).map(([key,label,roles]) => ({ key,label,roles })) })
  } catch (error) { next(error) }
})

// GET /:id/ai-reports - fetch saved AI reports linked to a workflow (audit trail)
router.get('/:id/ai-reports', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id=w.subject_employee_id WHERE w.id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Workflow not found.' })
    if (req.user.role === 'employee' && rows[0].subject_employee_id !== req.user.employeeId) return res.status(403).json({ error: 'You cannot view this workflow.' })
const reports = await getReportsForWorkflow(req.params.id)
    res.json({ reports })
  } catch (error) { next(error) }
})

// POST /:id/generate-report - Generate an AI report on demand for a completed
// workflow. HR can generate for any workflow; an employee can generate for
// their OWN workflow only. Creates a new immutable report row; previous reports
// stay in history. The newest report appears first.
router.post('/:id/generate-report', authorize('hr', 'employee'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [req.params.id])
    const workflow = rows[0]
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' })
    // Employees may only generate AI insights for their own validated workflows.
    if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) {
      return res.status(403).json({ error: 'You can only generate AI insights for your own workflows.' })
    }
    const report = await generateOnDemand(req.params.id, req.user.sub)
    res.status(201).json({ report })
  } catch (error) { next(error) }
})

router.post('/:id/notes', async (req, res, next) => {
  try {
    const input = noteSchema.parse(req.body)
    const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [req.params.id])
    const workflow = rows[0]
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' })
    if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) return res.status(403).json({ error: 'You cannot update this workflow.' })
const currentStage = stagesFor(workflow.module).find(([key]) => key === workflow.current_stage)
    // Allow the workflow subject to add notes on employee-assigned stages so
    // their self-assessment submission isn't blocked server-side.
    if (!canActOnStage(currentStage?.[2] || [], req.user.role, workflow.subject_employee_id, req.user.employeeId)) {
      return res.status(403).json({ error: `This workflow action is assigned to ${currentStage?.[2].join(' or ') || 'another role'}.` })
    }
    if (input.data?.type === 'training_schedule' && req.user.role !== 'hr') return res.status(403).json({ error: 'Only HR can record a verified training schedule.' })
    await query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'note', req.user.sub, input.note, input.data])
    await query('UPDATE workflows SET updated_at=NOW() WHERE id=$1', [workflow.id])
    res.status(201).json({ saved: true })
  } catch (error) { next(error) }
})

router.post('/:id/return', async (req, res, next) => {
  try {
    const input = returnSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) throw Object.assign(new Error('You cannot update this workflow.'), { status: 403 })
      const destination = returnToStage(workflow.module, workflow.current_stage, req.user.role, input.targetStage, workflow.subject_employee_id, req.user.employeeId)
      const update = await client.query('UPDATE workflows SET current_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [destination.key, workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, destination.key, 'returned', req.user.sub, input.note || null, { ...input.data, returnedFrom: workflow.current_stage, targetStage: destination.key }])
      await notifyNextOwners(client, workflow, destination)
      return { workflow: update.rows[0], returnedTo: destination.label }
    })
    res.json(result)
  } catch (error) { next(error) }
})

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const input = cancelSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
      const isCreator = req.user.sub === workflow.created_by
      const isHr = req.user.role === 'hr'
      if (!isCreator && !isHr) throw Object.assign(new Error('Only the workflow owner or HR can cancel this workflow.'), { status: 403 })
      if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) throw Object.assign(new Error('You cannot update this workflow.'), { status: 403 })
      await client.query("UPDATE workflows SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE id=$1", [workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'cancelled', req.user.sub, input.reason, input.data])
      return { cancelled: true, stage: workflow.current_stage }
    })
    res.json(result)
  } catch (error) { next(error) }
})

router.post('/:id/advance', async (req, res, next) => {
  try {
    const input = advanceSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM workflows WHERE id=$1 FOR UPDATE', [req.params.id]); const workflow = rows[0]
      if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
      if (workflow.status !== 'active') throw Object.assign(new Error('This workflow is already complete.'), { status: 409 })
if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) throw Object.assign(new Error('You cannot update this workflow.'), { status: 403 })
const destination = nextStage(workflow.module, workflow.current_stage, req.user.role, workflow.subject_employee_id, req.user.employeeId)
      if (!destination) {
        await client.query("UPDATE workflows SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1", [workflow.id])
        await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'completed', req.user.sub, input.note || null, input.data])
        // Score write-back: when a performance/competency/learning workflow completes, update the employee's scores
        if (workflow.subject_employee_id) {
          if (workflow.module === 'learning' && (workflow.metadata?.assignedFromCompetencyGap || input.data?.formData?.assignedFromCompetencyGap)) {
            await client.query(
              'UPDATE employees SET competency_score = LEAST(100, competency_score + 10), learning_progress = 100, updated_at = NOW() WHERE id = $1',
              [workflow.subject_employee_id]
            )
          } else if (input.scores) {
            const scoreUpdates = []
            if (input.scores.performanceScore !== undefined) scoreUpdates.push('performance_score = $1')
            if (input.scores.competencyScore !== undefined) scoreUpdates.push('competency_score = $2')
            if (input.scores.learningProgress !== undefined) scoreUpdates.push('learning_progress = $3')
            if (scoreUpdates.length > 0) {
              const scoreParams = [input.scores.performanceScore, input.scores.competencyScore, input.scores.learningProgress, workflow.subject_employee_id]
              await client.query(`UPDATE employees SET ${scoreUpdates.join(', ')}, updated_at = NOW() WHERE id = $4`, scoreParams)
            }
          }
        }
// AI-assisted analytics: calculate and save the module metrics so the
        // UI can show a "Ready to Generate AI Report" state. The AI report is
        // NOT generated automatically — HR generates it on demand via
        // POST /:id/generate-report. This is best-effort and never blocks
        // workflow completion even if metric calculation fails.
        try {
          const { metrics, details } = await calculateMetrics(workflow.module)
          await saveMetricsForWorkflow(client, workflow, req.user.sub, metrics)
          return { completed: true, stage: workflow.current_stage, metricsReady: true }
        } catch (aiError) {
          console.warn('[workflows] Could not save metrics for workflow completion:', aiError.message)
          return { completed: true, stage: workflow.current_stage, metricsReady: false }
        }
      }
      const update = await client.query('UPDATE workflows SET current_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [destination.key, workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, destination.key, 'advanced', req.user.sub, input.note || null, input.data])
      await notifyNextOwners(client, workflow, destination)
      return { workflow: update.rows[0], nextAction: destination.label }
    })
    res.json(result)
  } catch (error) { next(error) }
})

// POST /:id/due-date - set or update the due date on a workflow
router.post('/:id/due-date', async (req, res, next) => {
  try {
    const input = dueDateSchema.parse(req.body)
    const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Workflow not found.' })
    if (req.user.role === 'employee' && rows[0].subject_employee_id !== req.user.employeeId) return res.status(403).json({ error: 'You cannot update this workflow.' })
    const updated = await query('UPDATE workflows SET due_date=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [input.dueDate, req.params.id])
    res.json({ workflow: updated.rows[0] })
  } catch (error) { next(error) }
})

// GET /overdue - list workflows that are past their due date
router.get('/overdue', async (req, res, next) => {
  try {
    const input = overdueQuerySchema.parse(req.query)
    const params = []
    let where = "WHERE w.due_date IS NOT NULL AND w.due_date < NOW() AND w.status = 'active'"
    if (req.user.role === 'employee') { params.push(req.user.employeeId); where += ` AND w.subject_employee_id = $${params.length}` }
    const { rows } = await query(`SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id=w.subject_employee_id ${where} ORDER BY w.due_date ASC`, params)
    res.json({ workflows: rows, overdueCount: rows.length })
  } catch (error) { next(error) }
})
export default router
