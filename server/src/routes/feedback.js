import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()
router.use(authenticate)

const requestSchema = z.object({
  subjectEmployeeId: z.string().uuid(),
  relationship: z.enum(['peer', 'supervisor', 'subordinate', 'self']).default('peer'),
  message: z.string().max(2000).optional().default(''),
  authorEmployeeId: z.string().uuid(),
  dueDate: z.string().datetime().nullable().optional(),
})

const submitSchema = z.object({
  strengths: z.string().max(2000).optional().default(''),
  improvements: z.string().max(2000).optional().default(''),
  overallRating: z.number().min(0).max(5).optional(),
})

// GET /api/feedback — list feedback requests & submissions
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query
    const params = []
    let where = 'WHERE 1=1'
    // Employee sees feedback about them or from them
    if (req.user.role === 'employee') {
      params.push(req.user.employeeId)
      where += ` AND (fr.subject_employee_id = $${params.length} OR fr.requested_by = $${params.length})`
    }
    if (status) {
      params.push(status)
      where += ` AND fr.status = $${params.length}`
    }
    const { rows } = await query(
      `SELECT fr.*, 
        sub.full_name AS subject_name, 
        req_u.full_name AS requester_name,
        fs.strengths, fs.improvements, fs.overall_rating, fs.submitted_at AS submission_date
       FROM feedback_requests fr
       JOIN employees sub ON sub.id = fr.subject_employee_id
       JOIN users req_u ON req_u.id = fr.requested_by
       LEFT JOIN feedback_submissions fs ON fs.request_id = fr.id
       ${where}
       ORDER BY fr.created_at DESC`,
      params
    )
    res.json({ feedbackRequests: rows })
  } catch (error) { next(error) }
})

// POST /api/feedback — create a feedback request (anyone can request feedback about themselves)
router.post('/', async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body)
    // Only HR, supervisors, or the subject themselves can create requests
    if (req.user.role === 'employee' && input.subjectEmployeeId !== req.user.employeeId) {
      return res.status(403).json({ error: 'You can only request feedback about yourself.' })
    }
    const { rows } = await query(
      'INSERT INTO feedback_requests (subject_employee_id, requested_by, relationship, message, author_employee_id, due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [input.subjectEmployeeId, req.user.sub, input.relationship, input.message, input.authorEmployeeId, input.dueDate || null]
    )
    res.status(201).json({ feedbackRequest: rows[0] })
  } catch (error) { next(error) }
})

// GET /api/feedback/pending — feedback requests awaiting my submission
router.get('/pending', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT fr.*, sub.full_name AS subject_name, sub.department AS subject_department
       FROM feedback_requests fr
       JOIN employees sub ON sub.id = fr.subject_employee_id
       WHERE fr.author_employee_id = $1 AND fr.status = 'pending' AND fr.subject_employee_id != $2
       ORDER BY fr.created_at DESC`,
      [req.user.employeeId, req.user.employeeId]
    )
    res.json({ pendingRequests: rows })
  } catch (error) { next(error) }
})

// POST /api/feedback/:id/submit — submit feedback for a request
router.post('/:id/submit', async (req, res, next) => {
  try {
    const input = submitSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM feedback_requests WHERE id = $1 FOR UPDATE', [req.params.id])
      if (!rows[0]) throw Object.assign(new Error('Feedback request not found.'), { status: 404 })
      if (rows[0].status !== 'pending') throw Object.assign(new Error('This feedback request is already completed.'), { status: 409 })
      if (rows[0].author_employee_id !== req.user.employeeId) {
        throw Object.assign(new Error('This feedback request was not addressed to you.'), { status: 403 })
      }
      await client.query('INSERT INTO feedback_submissions (request_id, author_employee_id, strengths, improvements, overall_rating) VALUES ($1,$2,$3,$4,$5)', [req.params.id, req.user.employeeId, input.strengths, input.improvements, input.overallRating || null])
      await client.query("UPDATE feedback_requests SET status = 'submitted', updated_at = NOW() WHERE id = $1", [req.params.id])
      return { submitted: true }
    })
    res.json(result)
  } catch (error) { next(error) }
})

// POST /api/feedback/:id/close — close a feedback request (HR or requester)
router.post('/:id/close', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM feedback_requests WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Feedback request not found.' })
    const isHr = req.user.role === 'hr'
    const isRequester = req.user.sub === rows[0].requested_by
    if (!isHr && !isRequester) return res.status(403).json({ error: 'Only HR or the requester can close this.' })
    await query("UPDATE feedback_requests SET status = 'closed', updated_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ closed: true })
  } catch (error) { next(error) }
})

export default router
