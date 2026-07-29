import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { stagesFor, nextStage } from '../workflow.js'
import { authenticate } from '../middleware.js'

const router = Router()
const createSchema = z.object({ module: z.enum(['performance','competency','learning','training','succession','recognition']), subjectEmployeeId: z.string().uuid().nullable().optional(), title: z.string().min(3).max(140), metadata: z.record(z.unknown()).default({}) })
const advanceSchema = z.object({ note: z.string().max(2000).optional(), data: z.record(z.unknown()).default({}) })
const noteSchema = z.object({ note: z.string().min(1).max(2000), data: z.record(z.unknown()).default({}) })
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
    const { module, status = 'active' } = req.query
    const params = []; let where = 'WHERE w.status = $1'; params.push(status)
    if (module) { params.push(module); where += ` AND w.module = $${params.length}` }
    if (req.user.role === 'employee') { params.push(req.user.employeeId); where += ` AND w.subject_employee_id = $${params.length}` }
    const { rows } = await query(`SELECT w.*, e.full_name AS subject_name FROM workflows w LEFT JOIN employees e ON e.id = w.subject_employee_id ${where} ORDER BY w.updated_at DESC`, params)
    res.json({ workflows: rows })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body); const [initialStage] = stagesFor(input.module)
    if (!initialStage[2].includes(req.user.role)) return res.status(403).json({ error: 'Your role cannot start this workflow.' })
    const subjectEmployeeId = input.subjectEmployeeId || (req.user.role === 'employee' ? req.user.employeeId : null)
    const { rows } = await query('INSERT INTO workflows (module, title, subject_employee_id, current_stage, created_by, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [input.module, input.title, subjectEmployeeId, initialStage[0], req.user.sub, input.metadata])
    await query('INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, details) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, initialStage[0], 'created', req.user.sub, input.metadata])
    res.status(201).json({ workflow: rows[0] })
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

router.post('/:id/notes', async (req, res, next) => {
  try {
    const input = noteSchema.parse(req.body)
    const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [req.params.id])
    const workflow = rows[0]
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' })
    if (req.user.role === 'employee' && workflow.subject_employee_id !== req.user.employeeId) return res.status(403).json({ error: 'You cannot update this workflow.' })
    const currentStage = stagesFor(workflow.module).find(([key]) => key === workflow.current_stage)
    if (!currentStage?.[2].includes(req.user.role)) return res.status(403).json({ error: `This workflow action is assigned to ${currentStage?.[2].join(' or ') || 'another role'}.` })
    if (input.data?.type === 'training_schedule' && req.user.role !== 'hr') return res.status(403).json({ error: 'Only HR can record a verified training schedule.' })
    await query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'note', req.user.sub, input.note, input.data])
    await query('UPDATE workflows SET updated_at=NOW() WHERE id=$1', [workflow.id])
    res.status(201).json({ saved: true })
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
      const destination = nextStage(workflow.module, workflow.current_stage, req.user.role)
      if (!destination) {
        await client.query("UPDATE workflows SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1", [workflow.id])
        await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, workflow.current_stage, 'completed', req.user.sub, input.note || null, input.data])
        return { completed: true, stage: workflow.current_stage }
      }
      const update = await client.query('UPDATE workflows SET current_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [destination.key, workflow.id])
      await client.query('INSERT INTO workflow_events (workflow_id,stage,event_type,actor_id,note,details) VALUES ($1,$2,$3,$4,$5,$6)', [workflow.id, destination.key, 'advanced', req.user.sub, input.note || null, input.data])
      await notifyNextOwners(client, workflow, destination)
      return { workflow: update.rows[0], nextAction: destination.label }
    })
    res.json(result)
  } catch (error) { next(error) }
})
export default router
