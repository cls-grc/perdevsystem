import { Router } from 'express'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '30' } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30))
    const offset = (pageNum - 1) * limitNum
    const countResult = await query('SELECT count(*)::int AS total FROM notifications WHERE user_id=$1', [req.user.sub])
    const total = countResult.rows[0]?.total || 0
    const { rows } = await query('SELECT id, workflow_id, title, message, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [req.user.sub, limitNum, offset])
    res.json({ notifications: rows, unread: rows.filter(item => !item.is_read).length, total, page: pageNum, limit: limitNum })
  } catch (error) { next(error) }
})

router.post('/read', async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read=true, read_at=NOW() WHERE user_id=$1 AND is_read=false', [req.user.sub])
    res.json({ saved: true })
  } catch (error) { next(error) }
})
export default router
