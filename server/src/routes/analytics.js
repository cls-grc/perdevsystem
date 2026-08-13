import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { calculateReadiness } from '../services/metrics.js'
import { generateInsights } from '../services/openrouter.js'
import {
  calculateMetrics,
  generateAI,
  saveExecutiveReport,
  getLatestReports,
  getReportsForWorkflow,
} from '../services/aiReports.js'
import { getScopeFilter, getUserDepartment, verifyEmployeeAccess } from '../services/departmentScope.js'

const router = Router()
router.use(authenticate)

router.get('/dashboard', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const departmentScope = scope.isScoped ? scope.department : null
    if (scope.isScoped && !departmentScope) {
      return res.status(403).json({ error: 'Department Head and Operations Manager accounts require an active department assignment.' })
    }
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
    res.json({ totals: { ...totals[0], succession_ready: ready, departmentScope }, employees, workflowBreakdown: modules })
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
router.post('/insights', authorize('hr', 'supervisor'), async (req, res, next) => {
  try {
    const { employeeName } = insightRequest.parse(req.body || {})
    const scope = await getScopeFilter(req.user)
    const empWhere = scope.isScoped && scope.department ? ' AND department=$1' : ''
    const wfJoin = scope.isScoped && scope.department ? ' JOIN employees e ON e.id=w.subject_employee_id WHERE e.department=$1' : ''
    const succJoin = scope.isScoped && scope.department ? ' JOIN employees e ON e.id=sp.employee_id WHERE e.department=$1' : ''
    const params = scope.isScoped && scope.department ? [scope.department] : []

    const [{ rows: totals }, { rows: departments }, { rows: workflows }, { rows: succession }, { rows: recognition }] = await Promise.all([
      query(`SELECT count(*)::int AS employee_count, coalesce(round(avg(performance_score))::int,0) AS average_performance, coalesce(round(avg(competency_score))::int,0) AS average_competency, coalesce(round(avg(learning_progress))::int,0) AS learning_completion FROM employees WHERE is_active=true${empWhere}`, params),
      query(`SELECT department, count(*)::int AS employees, coalesce(round(avg(performance_score))::int,0) AS performance, coalesce(round(avg(learning_progress))::int,0) AS learning FROM employees WHERE is_active=true${empWhere} GROUP BY department ORDER BY department`, params),
      query(`SELECT w.module, w.current_stage, count(*)::int AS count FROM workflows w${wfJoin}${scope.isScoped && scope.department ? " AND w.status='active'" : " WHERE w.status='active'"} GROUP BY w.module, w.current_stage ORDER BY w.module`, params),
      query(`SELECT count(*) FILTER (WHERE sp.readiness_band='ready_now')::int AS ready_now_count FROM succession_profiles sp${succJoin}`, params),
      query(`SELECT count(*) FILTER (WHERE w.status='completed')::int AS completed_count FROM workflows w${wfJoin}${scope.isScoped && scope.department ? " AND w.module='recognition'" : " WHERE w.module='recognition'"}`, params),
    ])
    let employee = null
    if (employeeName) {
      const empParams = scope.isScoped && scope.department ? [employeeName, scope.department] : [employeeName]
      const empDeptWhere = scope.isScoped && scope.department ? ' AND department=$2' : ''
      const result = await query(`SELECT id, full_name, department, job_title, performance_score, competency_score, learning_progress FROM employees WHERE lower(full_name) = lower($1) AND is_active=true${empDeptWhere} LIMIT 1`, empParams)
      employee = result.rows[0]
      if (!employee) return res.status(404).json({ error: 'Employee record not found or outside your assigned department.' })
    }
    res.json({ insights: await generateInsights({ workforce: totals[0], departments, activeWorkflows: workflows, succession: succession[0], recognition: recognition[0], employee, departmentScope: scope.department }) })
  } catch (error) { next(error) }
})

// Module insights: compute metrics, generate AI, and return the structured report.
// Respects department scope for Department Heads.
router.post('/module-insights', authorize('hr', 'supervisor', 'employee', 'management', 'operations_manager'), async (req, res, next) => {
  try {
    const context = moduleInsightRequest.parse(req.body)
    const scope = await getScopeFilter(req.user)
    const deptOptions = scope.isScoped && scope.department ? { department: scope.department } : {}
    const { metrics, details } = await calculateMetrics(context.module, deptOptions)
    const report = await generateAI(context.module, metrics, details, deptOptions)
    const wfParams = scope.isScoped && scope.department ? [context.module, scope.department] : [context.module]
    const wfDeptJoin = scope.isScoped && scope.department ? ' JOIN employees e ON e.id=w.subject_employee_id WHERE w.module=$1 AND w.status=\'active\' AND e.department=$2' : ' WHERE w.module=$1 AND w.status=\'active\''
    const [{ rows: moduleWorkflows }] = await Promise.all([
      query(`SELECT w.current_stage, count(*)::int AS count FROM workflows w${wfDeptJoin} GROUP BY w.current_stage ORDER BY count DESC`, wfParams),
    ])
    res.json({ insights: [{ title: report.title, summary: report.content }], metrics, activeModuleWorkflows: moduleWorkflows })
  } catch (error) { next(error) }
})

// GET /executive-report - load the latest saved executive report (no regeneration on refresh).
router.get('/executive-report', authorize('hr', 'operations_manager', 'management'), async (req, res, next) => {
  try {
    const { metrics } = await calculateMetrics('executive')
    const latest = await getLatestReports('executive', { limit: 1 })
    let report = latest[0] || null
    if (report) {
      const gen = await query('SELECT full_name FROM users WHERE id=$1', [report.created_by])
      report = { ...report, generated_by_name: gen.rows[0]?.full_name || 'HR' }
    }
    res.json({ report, metrics })
  } catch (error) { next(error) }
})

// POST /executive-report - generate + save a new executive report (HR only).
router.post('/executive-report', authorize('hr'), async (req, res, next) => {
  try {
    const { metrics } = await calculateMetrics('executive')
    const report = await generateAI('executive', metrics)
    const saved = await saveExecutiveReport({ ...report, metricsJson: metrics }, req.user.sub, metrics)
    res.status(201).json({ report: saved })
  } catch (error) { next(error) }
})

// GET /workflows/:id/reports - fetch saved AI reports for a workflow (audit trail).
router.get('/workflows/:id/reports', authorize('hr', 'supervisor', 'management', 'employee'), async (req, res, next) => {
  try {
    const reports = await getReportsForWorkflow(req.params.id)
    res.json({ reports })
  } catch (error) { next(error) }
})

// GET /reports/:id/pdf - download a saved AI report as a lightweight PDF.
// Produces a simple text-based PDF from the report title + content so users
// can retain and share AI reports without adding a heavy PDF dependency.
router.get('/reports/:id/pdf', authorize('hr', 'supervisor', 'management', 'employee'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM ai_reports WHERE id=$1', [req.params.id])
    const report = rows[0]
    if (!report) return res.status(404).json({ error: 'Report not found.' })
    // Build a minimal single-page PDF (A4 portrait) from the report text.
    const title = report.title || 'AI Report'
    const body = (report.content || report.summary || '').replace(/#{1,3}\s+/g, '').replace(/\*\*/g, '')
    const text = `${title}\n\n${body}`
    const maxWidth = 90
    const lines = []
    text.split('\n').forEach(line => {
      let current = line
      while (current.length > maxWidth) {
        lines.push(current.slice(0, maxWidth))
        current = current.slice(maxWidth)
      }
      lines.push(current)
    })
    const lineHeight = 12
    const margin = 40
    const pageHeight = 792
    const maxLines = Math.floor((pageHeight - margin * 2) / lineHeight)
    const contentStream = []
    let y = margin
    let count = 0
    for (const line of lines) {
      if (count >= maxLines) {
        contentStream.push('BT 40 752 Td /F1 11 Tf (Page Break) Tj ET')
        y = margin
        count = 0
      }
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
      contentStream.push(`BT ${margin} ${y} Td /F1 10 Tf (${escaped}) Tj ET`)
      y -= lineHeight
      count++
    }
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${contentStream.join('\n').length} >> stream\n${contentStream.join('\n')}\nendstream endobj`,
    ]
    const pdf = `%PDF-1.4\n${objects.join('\n')}\ntrailer << /Root 1 0 R /Size 6 >>\n%%EOF`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${(title.replace(/\s+/g, '-') || 'report').toLowerCase()}.pdf"`)
    res.send(Buffer.from(pdf, 'latin1'))
  } catch (error) { next(error) }
})
export default router
