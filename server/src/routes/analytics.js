import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { calculateReadiness } from '../services/metrics.js'
import { generateInsights } from '../services/openrouter.js'

const router = Router()
router.use(authenticate)

router.get('/dashboard', authorize('hr', 'operations_manager'), async (_req, res, next) => {
  try {
    const [{ rows: totals }, { rows: employees }, { rows: modules }] = await Promise.all([
      query(`SELECT count(*)::int AS total_employees, coalesce(round(avg(performance_score))::int,0) AS average_performance,
        coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true`),
      query(`SELECT e.id, e.full_name, e.department, e.performance_score, e.competency_score, e.learning_progress,
        coalesce(s.readiness_band, 'development_needed') AS readiness FROM employees e
        LEFT JOIN succession_profiles s ON s.employee_id=e.id WHERE e.is_active=true ORDER BY e.full_name`),
      query(`SELECT module, status, count(*)::int AS count FROM workflows GROUP BY module, status ORDER BY module, status`),
    ])
    const ready = employees.filter((e) => calculateReadiness({ performance: e.performance_score, competency: e.competency_score, learning: e.learning_progress }).band === 'ready_now').length
    res.json({ totals: { ...totals[0], succession_ready: ready }, employees, workflowBreakdown: modules })
  } catch (error) { next(error) }
})

router.get('/me', async (req, res, next) => {
  try {
    if (!req.user.employeeId) return res.status(400).json({ error: 'This account is not linked to an employee record.' })
    const { rows } = await query('SELECT id, full_name, department, job_title, performance_score, competency_score, learning_progress FROM employees WHERE id=$1', [req.user.employeeId])
    if (!rows[0]) return res.status(404).json({ error: 'Employee record not found.' })
    const readiness = calculateReadiness({ performance: rows[0].performance_score, competency: rows[0].competency_score, learning: rows[0].learning_progress })
    res.json({ employee: rows[0], readiness })
  } catch (error) { next(error) }
})

const insightRequest = z.object({ employeeName: z.string().min(2).max(120).optional() })
const moduleInsightRequest = z.object({ module: z.enum(['performance','competency','learning','training','succession','recognition']), stage: z.string().min(2).max(140) })
router.post('/insights', authorize('hr', 'supervisor', 'operations_manager'), async (req, res, next) => {
  try {
    const { employeeName } = insightRequest.parse(req.body || {})
    const [{ rows: totals }, { rows: departments }, { rows: workflows }] = await Promise.all([
      query(`SELECT count(*)::int AS employee_count, coalesce(round(avg(performance_score))::int,0) AS average_performance, coalesce(round(avg(competency_score))::int,0) AS average_competency, coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true`),
      query(`SELECT department, count(*)::int AS employees, coalesce(round(avg(performance_score))::int,0) AS performance, coalesce(round(avg(learning_progress))::int,0) AS learning FROM employees WHERE is_active=true GROUP BY department ORDER BY department`),
      query(`SELECT module, current_stage, count(*)::int AS count FROM workflows WHERE status='active' GROUP BY module, current_stage ORDER BY module`),
    ])
    let employee = null
    if (employeeName) {
      const result = await query(`SELECT full_name, department, job_title, performance_score, competency_score, learning_progress FROM employees WHERE lower(full_name) = lower($1) AND is_active=true LIMIT 1`, [employeeName])
      employee = result.rows[0]
      if (!employee) return res.status(404).json({ error: 'Employee record not found in the database.' })
    }
    res.json({ insights: await generateInsights({ workforce: totals[0], departments, activeWorkflows: workflows, employee }) })
  } catch (error) { next(error) }
})

router.post('/module-insights', authorize('hr', 'supervisor', 'employee', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const context = moduleInsightRequest.parse(req.body)
    const [{ rows: workforce }, { rows: moduleWorkflows }] = await Promise.all([
      query(`SELECT count(*)::int AS employee_count, coalesce(round(avg(performance_score))::int,0) AS average_performance, coalesce(round(avg(competency_score))::int,0) AS average_competency, coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true`),
      query(`SELECT current_stage, count(*)::int AS count FROM workflows WHERE module=$1 AND status='active' GROUP BY current_stage ORDER BY count DESC`, [context.module]),
    ])
    res.json({ insights: await generateInsights({ moduleWorkflow: { ...context, scope: 'organization-wide' }, workforce: workforce[0], activeModuleWorkflows: moduleWorkflows }) })
  } catch (error) { next(error) }
})
export default router
