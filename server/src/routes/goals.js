import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()
router.use(authenticate)

const createGoalSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().default(''),
  category: z.enum(['personal', 'performance', 'learning', 'career']).default('personal'),
  objective: z.string().max(2000).optional().default(''),
  keyResults: z.array(z.object({
    title: z.string().min(1).max(200),
    target: z.number().min(0).max(100),
    current: z.number().min(0).max(100).default(0),
  })).optional().default([]),
  dueDate: z.string().datetime().nullable().optional(),
})

const updateGoalSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['personal', 'performance', 'learning', 'career']).optional(),
  objective: z.string().max(2000).optional(),
  keyResults: z.array(z.object({
    title: z.string().min(1).max(200),
    target: z.number().min(0).max(100),
    current: z.number().min(0).max(100),
  })).optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'pending_approval', 'completed', 'cancelled']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
})

const verifySchema = z.object({ comment: z.string().max(1000).optional().default('') })
const rejectSchema = z.object({ reason: z.string().min(3).max(1000) })
const cancelSchema = z.object({ reason: z.string().min(3).max(1000).optional().default('Cancelled') })

/** Compute progress as the rounded average of Key Results (Option C). */
function progressFromKeyResults(keyResults) {
  const krs = Array.isArray(keyResults) ? keyResults : []
  if (!krs.length) return 0
  const sum = krs.reduce((acc, kr) => {
    const target = Number(kr.target) || 0
    const current = Number(kr.current) || 0
    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
    return acc + pct
  }, 0)
  return Math.round(sum / krs.length)
}

/** Append a row to the progress audit trail (Option D). */
async function logProgress(client, { goalId, actorId, fromValue, toValue, fromStatus, toStatus, source, note = null }) {
  await client.query(
    'INSERT INTO goal_progress_history (goal_id, actor_id, from_value, to_value, from_status, to_status, source, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [goalId, actorId, fromValue, toValue, fromStatus, toStatus, source, note]
  )
}

// GET /api/goals — list goals (HR: all, manager: team, employee: own)
router.get('/', async (req, res, next) => {
  try {
    const { employeeId, status } = req.query
    const params = []
    let where = 'WHERE 1=1'
    if (req.user.role === 'employee') {
      params.push(req.user.employeeId)
      where += ` AND g.employee_id = $${params.length}`
    } else if (req.user.role === 'supervisor' && !employeeId) {
      // Supervisors see their own team
      params.push(req.user.employeeId)
      where += ` AND (g.employee_id = $${params.length} OR g.employee_id IN (SELECT id FROM employees WHERE manager_id = $${params.length}))`
    }
    if (employeeId) {
      params.push(employeeId)
      where += ` AND g.employee_id = $${params.length}`
    }
    if (status) {
      params.push(status)
      where += ` AND g.status = $${params.length}`
    }
    const { rows } = await query(
      `SELECT g.*, e.full_name AS employee_name,
        u.full_name AS verified_by_name
        FROM goals g
        JOIN employees e ON e.id = g.employee_id
        LEFT JOIN users u ON u.id = g.verified_by
        ${where} ORDER BY g.updated_at DESC`,
      params
    )
    res.json({ goals: rows })
  } catch (error) { next(error) }
})

// GET /api/goals/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT g.*, e.full_name AS employee_name, u.full_name AS verified_by_name
        FROM goals g
        JOIN employees e ON e.id = g.employee_id
        LEFT JOIN users u ON u.id = g.verified_by
        WHERE g.id = $1`,
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Goal not found.' })
    if (req.user.role === 'employee' && rows[0].employee_id !== req.user.employeeId) {
      return res.status(403).json({ error: 'You cannot view this goal.' })
    }
    res.json({ goal: rows[0] })
  } catch (error) { next(error) }
})

// POST /api/goals — create a goal (progress auto-computed from KRs)
router.post('/', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = createGoalSchema.parse(req.body)
    const progress = progressFromKeyResults(input.keyResults)
    const created = await transaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO goals (employee_id, title, description, category, objective, key_results, progress, due_date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [input.employeeId, input.title, input.description, input.category, input.objective, JSON.stringify(input.keyResults), progress, input.dueDate || null, req.user.sub]
      )
      await logProgress(client, { goalId: rows[0].id, actorId: req.user.sub, fromValue: 0, toValue: progress, fromStatus: null, toStatus: 'active', source: 'create', note: 'Goal created' })
      return rows[0]
    })
    res.status(201).json({ goal: created })
  } catch (error) { next(error) }
})

// PATCH /api/goals/:id — update a goal
// - If keyResults are supplied, progress is auto-recomputed from them (Option C).
// - Reaching 100% moves the goal to pending_approval (Option A).
// - Every change is recorded in the audit trail (Option D).
router.patch('/:id', async (req, res, next) => {
  try {
    const input = updateGoalSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM goals WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Goal not found.'), { status: 404 })
      const existing = rows[0]
      if (req.user.role === 'employee' && existing.employee_id !== req.user.employeeId) {
        throw Object.assign(new Error('You cannot update this goal.'), { status: 403 })
      }

      // Determine which fields change
      let newKeyResults = existing.key_results
      let newProgress = Number(existing.progress)
      let newStatus = existing.status

      if (input.keyResults !== undefined) {
        newKeyResults = input.keyResults
        newProgress = progressFromKeyResults(newKeyResults)
      } else if (input.progress !== undefined) {
        newProgress = Math.round(input.progress)
      }

      // Status transitions
      if (input.status !== undefined) newStatus = input.status
      else if (input.keyResults !== undefined || input.progress !== undefined) {
        // Auto status handling: completed/pending_approval cannot be reverted by normal progress edits
        if (existing.status === 'active') {
          if (newProgress >= 100) newStatus = 'pending_approval'
          else newStatus = 'active'
        }
      }

      // Build dynamic UPDATE
      const fields = []
      const params = [req.params.id]
      let idx = 2
      const applyField = (column, value, cast = '') => {
        fields.push(`${column} = $${idx}${cast}`)
        params.push(value)
        idx++
      }
      if (input.title !== undefined) applyField('title', input.title)
      if (input.description !== undefined) applyField('description', input.description)
      if (input.category !== undefined) applyField('category', input.category)
      if (input.objective !== undefined) applyField('objective', input.objective)
      if (input.keyResults !== undefined) applyField('key_results', JSON.stringify(newKeyResults), '::jsonb')
      if (input.progress !== undefined || input.keyResults !== undefined) applyField('progress', newProgress)
      if (input.status !== undefined || newStatus !== existing.status) applyField('status', newStatus)
      if (input.dueDate !== undefined) applyField('due_date', input.dueDate)
      if (input.dueDate !== undefined || input.title !== undefined || input.description !== undefined || input.category !== undefined || input.objective !== undefined || input.keyResults !== undefined || input.progress !== undefined || newStatus !== existing.status) {
        // already adding updated_at below
      }
      fields.push('updated_at = NOW()')

      const updated = await client.query(`UPDATE goals SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      const goal = updated.rows[0]

      // Audit trail
      if (Number(goal.progress) !== Number(existing.progress) || goal.status !== existing.status) {
        await logProgress(client, {
          goalId: goal.id,
          actorId: req.user.sub,
          fromValue: existing.progress,
          toValue: goal.progress,
          fromStatus: existing.status,
          toStatus: goal.status,
          source: input.keyResults !== undefined ? 'auto_kr' : 'manual',
          note: input.keyResults !== undefined ? 'Progress auto-recomputed from key results' : null,
        })
      }
      return goal
    })
    res.json({ goal: result })
  } catch (error) { next(error) }
})

// POST /api/goals/:id/verify — admin approves a pending_approval goal (Option A)
router.post('/:id/verify', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = verifySchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM goals WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Goal not found.'), { status: 404 })
      const goal = rows[0]
      if (goal.status !== 'pending_approval') {
        throw Object.assign(new Error('Only goals pending approval can be verified.'), { status: 409 })
      }
      const updated = await client.query(
        `UPDATE goals SET status = 'completed', verified_by = $1, verified_at = NOW(), verified_comment = $2, rejection_reason = NULL, rejection_at = NULL, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [req.user.sub, input.comment, req.params.id]
      )
      await logProgress(client, {
        goalId: goal.id,
        actorId: req.user.sub,
        fromValue: goal.progress,
        toValue: goal.progress,
        fromStatus: goal.status,
        toStatus: 'completed',
        source: 'verify',
        note: input.comment || 'Verified by reviewer',
      })
      return updated.rows[0]
    })
    res.json({ goal: result, verified: true })
  } catch (error) { next(error) }
})

// POST /api/goals/:id/reject — admin rejects a pending_approval goal, returning it to active (Option A)
router.post('/:id/reject', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = rejectSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM goals WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Goal not found.'), { status: 404 })
      const goal = rows[0]
      if (goal.status !== 'pending_approval') {
        throw Object.assign(new Error('Only goals pending approval can be rejected.'), { status: 409 })
      }
      const updated = await client.query(
        `UPDATE goals SET status = 'active', rejection_reason = $1, rejection_at = NOW(), verified_by = NULL, verified_at = NULL, verified_comment = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [input.reason, req.params.id]
      )
      await logProgress(client, {
        goalId: goal.id,
        actorId: req.user.sub,
        fromValue: goal.progress,
        toValue: goal.progress,
        fromStatus: goal.status,
        toStatus: 'active',
        source: 'reject',
        note: input.reason,
      })
      return updated.rows[0]
    })
    res.json({ goal: result, rejected: true })
  } catch (error) { next(error) }
})

// GET /api/goals/:id/history — full progress audit trail (Option D)
router.get('/:id/history', async (req, res, next) => {
  try {
    const { rows: goalRows } = await query('SELECT employee_id FROM goals WHERE id = $1', [req.params.id])
    if (!goalRows[0]) return res.status(404).json({ error: 'Goal not found.' })
    if (req.user.role === 'employee' && goalRows[0].employee_id !== req.user.employeeId) {
      return res.status(403).json({ error: 'You cannot view this goal.' })
    }
    const { rows } = await query(
      `SELECT h.*, u.full_name AS actor_name
        FROM goal_progress_history h
        JOIN users u ON u.id = h.actor_id
        WHERE h.goal_id = $1
        ORDER BY h.created_at ASC`,
      [req.params.id]
    )
    res.json({ history: rows })
  } catch (error) { next(error) }
})

// DELETE /api/goals/:id (soft delete — set status to cancelled)
router.delete('/:id', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const input = cancelSchema.parse(req.body || {})
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM goals WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Goal not found.'), { status: 404 })
      const goal = rows[0]
      if (goal.status === 'cancelled') throw Object.assign(new Error('Goal is already cancelled.'), { status: 409 })
      const updated = await client.query(
        `UPDATE goals SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW(), cancellation_reason = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [req.user.sub, input.reason, req.params.id]
      )
      await logProgress(client, {
        goalId: goal.id,
        actorId: req.user.sub,
        fromValue: goal.progress,
        toValue: goal.progress,
        fromStatus: goal.status,
        toStatus: 'cancelled',
        source: 'manual',
        note: input.reason,
      })
      return updated.rows[0]
    })
    res.json({ cancelled: true, goal: result })
  } catch (error) { next(error) }
})

// POST /api/goals/:id/restore — bring a cancelled goal back to Active
router.post('/:id/restore', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM goals WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Goal not found.'), { status: 404 })
      const goal = rows[0]
      if (goal.status !== 'cancelled') throw Object.assign(new Error('Only cancelled goals can be restored.'), { status: 409 })
      const updated = await client.query(
        `UPDATE goals SET status = 'active', cancelled_by = NULL, cancelled_at = NULL, cancellation_reason = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      )
      await logProgress(client, {
        goalId: goal.id,
        actorId: req.user.sub,
        fromValue: goal.progress,
        toValue: goal.progress,
        fromStatus: goal.status,
        toStatus: 'active',
        source: 'manual',
        note: 'Goal restored',
      })
      return updated.rows[0]
    })
    res.json({ restored: true, goal: result })
  } catch (error) { next(error) }
})

export default router

