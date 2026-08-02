import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { calculateReadiness } from '../services/metrics.js'
import { generateInsights } from '../services/openrouter.js'

const router = Router()
router.use(authenticate)

router.get('/dashboard', authorize('hr', 'operations_manager'), async (req, res, next) => {
  try {
    const departmentScope = req.user.role === 'operations_manager'
      ? (await query('SELECT department FROM employees WHERE id=$1 AND is_active=true', [req.user.employeeId])).rows[0]?.department
      : null
    if (req.user.role === 'operations_manager' && !departmentScope) return res.status(403).json({ error: 'Operations Manager accounts require an active department assignment.' })
    const employeeWhere = departmentScope ? ' AND department=$1' : ''
    const workflowJoin = departmentScope ? ' JOIN employees e ON e.id=w.subject_employee_id WHERE e.department=$1' : ''
    const params = departmentScope ? [departmentScope] : []
    const [{ rows: totals }, { rows: employees }, { rows: modules }] = await Promise.all([
      query(`SELECT count(*)::int AS total_employees, coalesce(round(avg(performance_score))::int,0) AS average_performance,
        coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true${employeeWhere}`, params),
      query(`SELECT e.id, e.full_name, e.department, e.performance_score, e.competency_score, e.learning_progress,
        coalesce(s.readiness_band, 'development_needed') AS readiness FROM employees e
        LEFT JOIN succession_profiles s ON s.employee_id=e.id WHERE e.is_active=true${employeeWhere} ORDER BY e.full_name`, params),
      query(`SELECT w.module, w.status, count(*)::int AS count FROM workflows w${workflowJoin}${departmentScope ? ' GROUP BY w.module, w.status ORDER BY w.module, w.status' : ' GROUP BY w.module, w.status ORDER BY w.module, w.status'}`, params),
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
const moduleMetricQueries = {
  performance: `SELECT count(*)::int AS employee_count, coalesce(round(avg(performance_score))::int,0) AS average_score, (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='active') AS active_count, (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='completed') AS completed_count FROM employees WHERE is_active=true`,
  competency: `SELECT count(*)::int AS employee_count, coalesce(round(avg(competency_score))::int,0) AS average_score FROM employees WHERE is_active=true`,
  learning: `SELECT count(*)::int AS employee_count, coalesce(round(avg(learning_progress))::int,0) AS average_score, count(*) FILTER (WHERE learning_progress=100)::int AS completed_count FROM employees WHERE is_active=true`,
  training: `SELECT count(*) FILTER (WHERE w.status='active')::int AS active_count, count(*) FILTER (WHERE w.status='completed')::int AS completed_count, count(DISTINCT w.id) FILTER (WHERE e.details->>'type'='training_schedule')::int AS scheduled_count FROM workflows w LEFT JOIN workflow_events e ON e.workflow_id=w.id WHERE w.module='training'`,
  succession: `SELECT count(*)::int AS candidate_count, coalesce(round(avg(readiness_score))::int,0) AS average_readiness, count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count, count(*) FILTER (WHERE readiness_band='ready_in_1_2_years')::int AS ready_later_count, count(*) FILTER (WHERE readiness_band='development_needed')::int AS development_count FROM succession_profiles`,
  recognition: `SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count FROM workflows WHERE module='recognition'`,
}
router.post('/insights', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const { employeeName } = insightRequest.parse(req.body || {})
    const [{ rows: totals }, { rows: departments }, { rows: workflows }, { rows: succession }, { rows: recognition }] = await Promise.all([
      query(`SELECT count(*)::int AS employee_count, coalesce(round(avg(performance_score))::int,0) AS average_performance, coalesce(round(avg(competency_score))::int,0) AS average_competency, coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true`),
      query(`SELECT department, count(*)::int AS employees, coalesce(round(avg(performance_score))::int,0) AS performance, coalesce(round(avg(learning_progress))::int,0) AS learning FROM employees WHERE is_active=true GROUP BY department ORDER BY department`),
      query(`SELECT module, current_stage, count(*)::int AS count FROM workflows WHERE status='active' GROUP BY module, current_stage ORDER BY module`),
      query(`SELECT count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count FROM succession_profiles`),
      query(`SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count FROM workflows WHERE module='recognition'`),
    ])
    let employee = null
    if (employeeName) {
      const result = await query(`SELECT full_name, department, job_title, performance_score, competency_score, learning_progress FROM employees WHERE lower(full_name) = lower($1) AND is_active=true LIMIT 1`, [employeeName])
      employee = result.rows[0]
      if (!employee) return res.status(404).json({ error: 'Employee record not found in the database.' })
    }
    res.json({ insights: await generateInsights({ workforce: totals[0], departments, activeWorkflows: workflows, succession: succession[0], recognition: recognition[0], employee }) })
  } catch (error) { next(error) }
})

router.post('/module-insights', authorize('hr', 'supervisor', 'employee', 'management'), async (req, res, next) => {
  try {
    const context = moduleInsightRequest.parse(req.body)
    const detailsQuery = context.module === 'performance'
      ? `SELECT (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score DESC, full_name LIMIT 1) AS top_name, (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score DESC, full_name LIMIT 1) AS top_score, (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score, full_name LIMIT 1) AS bottom_name, (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score, full_name LIMIT 1) AS bottom_score`
      : context.module === 'recognition'
        ? `SELECT e.full_name AS top_name, count(*)::int AS top_count FROM workflows w JOIN employees e ON e.id=w.subject_employee_id WHERE w.module='recognition' GROUP BY e.full_name ORDER BY count(*) DESC, e.full_name LIMIT 1`
        : 'SELECT NULL::text AS top_name'
    const [{ rows: moduleWorkflows }, { rows: metricRows }, { rows: detailRows }] = await Promise.all([
      query(`SELECT current_stage, count(*)::int AS count FROM workflows WHERE module=$1 AND status='active' GROUP BY current_stage ORDER BY count DESC`, [context.module]),
      query(moduleMetricQueries[context.module]),
      query(detailsQuery),
    ])
    res.json({ insights: await generateInsights({ moduleWorkflow: { ...context, scope: 'organization-wide' }, moduleMetrics: metricRows[0], moduleDetails: detailRows[0], activeModuleWorkflows: moduleWorkflows }) })
  } catch (error) { next(error) }
})
export default router
