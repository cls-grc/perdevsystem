import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import { config } from './config.js'
import { query } from './db.js'

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication is required.' })
  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    // Check if token is an access token (15min expiry) — not a long-lived one
    if (decoded.exp && decoded.exp - decoded.iat > 3600) {
      return res.status(401).json({ error: 'Invalid token type.' })
    }
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired.' })
  }
}

export function authorize(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have access to this action.' })
}

export function notFound(_req, res) { res.status(404).json({ error: 'Resource not found.' }) }
export function errorHandler(error, _req, res, _next) {
  console.error(error)
  if (error instanceof ZodError) return res.status(400).json({ error: 'Please check the submitted information.', fields: error.flatten().fieldErrors })
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' })
}
