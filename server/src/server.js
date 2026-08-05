import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import workflowRoutes from './routes/workflows.js'
import analyticsRoutes from './routes/analytics.js'
import certificateRoutes from './routes/certificates.js'
import notificationRoutes from './routes/notifications.js'
import employeeRoutes from './routes/employees.js'
import auditRoutes from './routes/audit.js'
import { errorHandler, notFound } from './middleware.js'
import { pool } from './db.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.clientOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '12mb' }))
app.get('/health', async (_req, res, next) => { try { await pool.query('SELECT 1'); res.json({ status: 'ok' }) } catch (error) { next(error) } })
app.use('/api/auth', authRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use(notFound)
app.use(errorHandler)
app.listen(config.port, () => console.log(`PDS API listening on port ${config.port}`))
