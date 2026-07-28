import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query } from '../db.js'
import { config } from '../config.js'

const router = Router()
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) })

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body)
    const { rows } = await query('SELECT id, email, password_hash, role, full_name, employee_id FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' })
    const token = jwt.sign({ sub: user.id, role: user.role, employeeId: user.employee_id, name: user.full_name }, config.jwtSecret, { expiresIn: '8h' })
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.full_name } })
  } catch (error) { next(error) }
})
export default router
