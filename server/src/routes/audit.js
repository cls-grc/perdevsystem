import { Router } from 'express'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()
router.use(authenticate)

// GET /api/audit-logs — paginated, filterable audit log of workflow events
router.get('/', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit

    const params = []
    let where = 'WHERE 1=1'
    let idx = 1

    if (req.query.module) {
      params.push(req.query.module)
      where += ` AND w.module = $${idx++}`
    }
    if (req.query.actorId) {
      params.push(req.query.actorId)
      where += ` AND we.actor_id = $${idx++}`
    }
    if (req.query.eventType) {
      params.push(req.query.eventType)
      where += ` AND we.event_type = $${idx++}`
    }
    if (req.query.workflowId) {
      params.push(req.query.workflowId)
      where += ` AND we.workflow_id = $${idx++}`
    }

    const [{ rows: countRows }, { rows }] = await Promise.all([
      query(`SELECT count(*)::int AS total FROM workflow_events we JOIN workflows w ON w.id = we.workflow_id ${where}`, params),
      query(`
        SELECT we.id, we.workflow_id, we.stage, we.event_type, we.actor_id,
               u.full_name AS actor_name, we.note, we.details, we.created_at,
               w.module, w.title AS workflow_title
        FROM workflow_events we
        JOIN workflows w ON w.id = we.workflow_id
        JOIN users u ON u.id = we.actor_id
        ${where}
        ORDER BY we.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...params, limit, offset]),
    ])

    res.json({
      events: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limit),
      },
    })
  } catch (error) { next(error) }
})

export default router
