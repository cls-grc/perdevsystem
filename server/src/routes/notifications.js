import { Router } from 'express'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, workflow_id, title, message, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [req.user.sub])
    res.json({ notifications: rows, unread: rows.filter(item => !item.is_read).length })
  } catch (error) { next(error) }
})

router.post('/read', async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read=true, read_at=NOW() WHERE user_id=$1 AND is_read=false', [req.user.sub])
    res.json({ saved: true })
  } catch (error) { next(error) }
})
export default router
