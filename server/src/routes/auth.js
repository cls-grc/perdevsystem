import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { query, transaction } from '../db.js'
import { config } from '../config.js'
import { authenticate, authorize } from '../middleware.js'
import { sendEmail } from '../services/email.js'

const router = Router()
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) })
const registerSchema = z.object({ token: z.string().uuid(), password: z.string().min(8).max(128) })
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['employee', 'supervisor', 'management', 'hr', 'operations_manager']).default('employee'),
  fullName: z.string().min(1).max(120),
  departmentId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
})
const refreshSchema = z.object({ refreshToken: z.string().min(1) })
const forgotSchema = z.object({ email: z.string().email() })
const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(128) })

// Rate limiting: max 5 login attempts per IP per minute
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a minute.' },
})

// Helper: generate access token (15min) + refresh token (7d)
async function generateTokens(user, req) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, employeeId: user.employee_id, name: user.full_name },
    config.jwtSecret,
    { expiresIn: '15m' }
  )
  const refreshToken = crypto.randomUUID()
  try {
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    await query(
      'INSERT INTO sessions (user_id, refresh_token, user_agent, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, refreshToken, req.headers['user-agent'] || null, req.ip || null, expiresAt]
    )
  } catch {
    // If sessions table doesn't exist yet (migration not run), fall back gracefully
    console.warn('[PDS] Could not persist refresh token — sessions table may not exist yet. Run `npm run migrate`.')
  }
  return { accessToken, refreshToken }
}

// POST /api/auth/login — rate-limited, returns access + refresh tokens
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body)
    const { rows } = await query('SELECT id, email, password_hash, role, full_name, employee_id FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' })
    const tokens = await generateTokens(user, req)
    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.full_name },
    })
  } catch (error) { next(error) }
})

// POST /api/auth/refresh — exchange refresh token for new access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT s.*, u.email, u.role, u.full_name, u.employee_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.refresh_token = $1 AND s.is_revoked = false AND s.expires_at > NOW()',
        [refreshToken]
      )
      if (!rows[0]) throw Object.assign(new Error('Refresh token is invalid or has expired.'), { status: 401 })
      const session = rows[0]
      // Revoke old session
      await client.query('UPDATE sessions SET is_revoked = true WHERE id = $1', [session.id])
      // Issue new tokens
      const newAccessToken = jwt.sign(
        { sub: session.user_id, role: session.role, employeeId: session.employee_id, name: session.full_name },
        config.jwtSecret,
        { expiresIn: '15m' }
      )
      const newRefreshToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
      await client.query(
        'INSERT INTO sessions (user_id, refresh_token, user_agent, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [session.user_id, newRefreshToken, req.headers['user-agent'] || null, req.ip || null, expiresAt]
      )
      return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    })
    res.json({ token: result.accessToken, refreshToken: result.refreshToken })
  } catch (error) {
    // If the sessions table doesn't exist, the table query itself will throw.
    // Detect that case and return a clear message.
    if (error?.code === '42P01' || error?.message?.includes('relation "sessions" does not exist')) {
      return res.status(503).json({ error: 'Session management is not available. Please run the database migration (009_auth_session.sql).' })
    }
    next(error)
  }
})

// POST /api/auth/logout — revoke refresh token
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body || { refreshToken: '' })
    if (refreshToken) {
      try {
        await query('UPDATE sessions SET is_revoked = true WHERE refresh_token = $1', [refreshToken])
      } catch {
        // sessions table may not exist yet — that's fine, logout is best-effort
      }
    }
    res.json({ saved: true })
  } catch (error) { next(error) }
})

// POST /api/auth/forgot-password — generate reset token
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body)
    const { rows } = await query('SELECT id FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()])
    if (rows[0]) {
      const resetToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour
      await query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)', [rows[0].id, resetToken, expiresAt])
      const origin = config.clientOrigin || 'http://localhost:5173'
      const resetUrl = `${origin}/reset-password?token=${resetToken}`
      await sendEmail({
        to: email,
        subject: 'Reset your PerDevSys password',
        text: `You requested a password reset. Open this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      })
    }
    // Always return success to avoid user enumeration
    res.json({ message: 'If that email is registered, a password reset link has been sent.' })
  } catch (error) { next(error) }
})

// POST /api/auth/reset-password — complete password reset
router.post('/reset-password', async (req, res, next) => {
  try {
    const input = resetSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM password_resets WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
        [input.token]
      )
      if (!rows[0]) throw Object.assign(new Error('Reset link is invalid or has expired.'), { status: 410 })
      const passwordHash = await bcrypt.hash(input.password, 12)
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, rows[0].user_id])
      await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [rows[0].id])
      // Revoke all sessions for this user (force re-login)
      await client.query('UPDATE sessions SET is_revoked = true WHERE user_id = $1', [rows[0].user_id])
      return { saved: true }
    })
    res.json(result)
  } catch (error) { next(error) }
})

// POST /api/auth/invite — HR creates an invitation
router.post('/invite', authenticate, authorize('hr'), async (req, res, next) => {
  try {
    const input = inviteSchema.parse(req.body)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    const { rows } = await query(`
      INSERT INTO invitations (email, role, full_name, department_id, employee_id, token, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, role, full_name, expires_at
    `, [input.email, input.role, input.fullName, input.departmentId || null, input.employeeId || null, token, expiresAt, req.user.sub])
    const origin = config.clientOrigin || 'http://localhost:5173'
    const registerUrl = `${origin}/register?token=${token}`
    await sendEmail({
      to: input.email,
      subject: 'You have been invited to PerDevSys',
      text: `Hello ${input.fullName},\n\nYou have been invited to join PerDevSys as ${input.role}. Set your password using this link (valid for 7 days):\n\n${registerUrl}\n\nIf you did not expect this invitation, you can ignore this email.`,
    })
    res.status(201).json({
      invitation: rows[0],
      registerUrl,
    })
  } catch (error) { next(error) }
})

// POST /api/auth/register — complete signup using an invitation token
router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM invitations WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()', [input.token])
      const invitation = rows[0]
      if (!invitation) throw Object.assign(new Error('Invitation link is invalid or has expired.'), { status: 410 })
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [invitation.email])
      if (existing.rowCount) throw Object.assign(new Error('An account with this email already exists.'), { status: 409 })
      const passwordHash = await bcrypt.hash(input.password, 12)
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, full_name, role, employee_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name, employee_id',
        [invitation.email, passwordHash, invitation.full_name, invitation.role, invitation.employee_id]
      )
      await client.query('UPDATE invitations SET used_at = NOW() WHERE id = $1', [invitation.id])
      const user = userResult.rows[0]
      const accessToken = jwt.sign(
        { sub: user.id, role: user.role, employeeId: user.employee_id, name: user.full_name },
        config.jwtSecret,
        { expiresIn: '15m' }
      )
      const refreshToken = crypto.randomUUID()
      try {
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
        await client.query(
          'INSERT INTO sessions (user_id, refresh_token, user_agent, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
          [user.id, refreshToken, req.headers['user-agent'] || null, req.ip || null, expiresAt]
        )
      } catch {
        console.warn('[PDS] Could not persist refresh token during registration — sessions table may not exist yet.')
      }
      return { token: accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, name: user.full_name } }
    })
    res.status(201).json(result)
  } catch (error) { next(error) }
})

export default router
