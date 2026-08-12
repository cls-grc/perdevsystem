import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate, authorize } from '../middleware.js'
import { logActivity } from '../services/activity.js'
import { getScopeFilter, verifyEmployeeAccess } from '../services/departmentScope.js'

const router = Router()
router.use(authenticate)

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  fullName: z.string().min(1).max(120),
  departmentId: z.string().uuid(),
  jobTitle: z.string().min(1).max(120),
  managerId: z.string().uuid().nullable().optional(),
  performanceScore: z.number().min(0).max(100).optional().default(0),
  competencyScore: z.number().min(0).max(100).optional().default(0),
  learningProgress: z.number().min(0).max(100).optional().default(0),
})

const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  departmentId: z.string().uuid().optional(),
  jobTitle: z.string().min(1).max(120).optional(),
  managerId: z.string().uuid().nullable().optional(),
  performanceScore: z.number().min(0).max(100).optional(),
  competencyScore: z.number().min(0).max(100).optional(),
  learningProgress: z.number().min(0).max(100).optional(),
})

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['employee', 'supervisor', 'management', 'hr', 'operations_manager']).default('employee'),
  fullName: z.string().min(1).max(120),
  departmentId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
})

// !!! Static routes must be defined BEFORE parameterized /:id routes !!!

// GET /api/employees/departments — list departments
router.get('/departments', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, created_at FROM departments ORDER BY name')
    res.json({ departments: rows })
  } catch (error) { next(error) }
})

// POST /api/employees/invite — send invite (HR only)
router.post('/invite', authorize('hr'), async (req, res, next) => {
  try {
    const input = inviteSchema.parse(req.body)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    const { rows } = await query(`
      INSERT INTO invitations (email, role, full_name, department_id, employee_id, token, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, role, full_name, expires_at
    `, [input.email, input.role, input.fullName, input.departmentId || null, input.employeeId || null, token, expiresAt, req.user.sub])
    await logActivity({ req, user: req.user, action: 'employee.invite', category: 'auth', description: `${req.user.name} invited ${input.fullName} (${input.role})`, details: { email: input.email, role: input.role } })
    res.status(201).json({
      invitation: rows[0],
      registerUrl: `${req.protocol}://${req.get('host')}/register?token=${token}`,
    })
  } catch (error) { next(error) }
})

// GET /api/employees — list active employees (scoped to department for supervisors)
router.get('/', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const scope = await getScopeFilter(req.user)
    const params = []
    let where = 'WHERE e.is_active = true'
    if (scope.isScoped && scope.department) {
      params.push(scope.department)
      where += ` AND e.department = $${params.length}`
    }
    const { rows } = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
             e.manager_id, m.full_name AS manager_name,
             e.performance_score, e.competency_score, e.learning_progress, e.is_active,
             e.created_at, e.updated_at,
             d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      ${where}
      ORDER BY e.full_name
    `, params)
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/all — list all employees including inactive (HR only)
router.get('/all', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT e.id, e.employee_number, e.full_name, e.department, e.department_id, e.job_title,
             e.manager_id, m.full_name AS manager_name,
             e.performance_score, e.competency_score, e.learning_progress, e.is_active,
             e.created_at, e.updated_at,
             d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER BY e.is_active DESC, e.full_name
    `)
    res.json({ employees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/reportees/:id — employees who report to given manager
router.get('/reportees/:id', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    await verifyEmployeeAccess(req.user, req.params.id)
    const { rows } = await query('SELECT id, full_name, job_title FROM employees WHERE manager_id = $1 AND is_active = true ORDER BY full_name', [req.params.id])
    res.json({ reportees: rows })
  } catch (error) { next(error) }
})

// GET /api/employees/:id — single employee
router.get('/:id', authorize('hr', 'operations_manager', 'supervisor', 'employee'), async (req, res, next) => {
  try {
    await verifyEmployeeAccess(req.user, req.params.id)
    const { rows } = await query(`
      SELECT e.*, m.full_name AS manager_name, d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1
    `, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
    res.json({ employee: rows[0] })
  } catch (error) { next(error) }
})


// POST /api/employees — create employee (HR only)
router.post('/', authorize('hr'), async (req, res, next) => {
  try {
    const input = createEmployeeSchema.parse(req.body)
    const { rows } = await query(`
      INSERT INTO employees (employee_number, full_name, department_id, department, job_title, manager_id, performance_score, competency_score, learning_progress)
      VALUES ($1, $2, $3, (SELECT name FROM departments WHERE id = $3), $4, $5, $6, $7, $8)
      RETURNING *
    `, [input.employeeNumber, input.fullName, input.departmentId, input.jobTitle, input.managerId || null, input.performanceScore, input.competencyScore, input.learningProgress])
await query('INSERT INTO score_history (employee_id, performance_score, competency_score, learning_progress) VALUES ($1, $2, $3, $4)', [rows[0].id, rows[0].performance_score, rows[0].competency_score, rows[0].learning_progress])
    await logActivity({ req, user: req.user, action: 'employee.create', category: 'employee', targetId: rows[0].id, description: `${req.user.name} created employee ${input.fullName}`, details: { employeeNumber: input.employeeNumber, departmentId: input.departmentId } })
    res.status(201).json({ employee: rows[0] })
  } catch (error) { next(error) }
})

// PATCH /api/employees/:id — update employee (HR only)
router.patch('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const input = updateEmployeeSchema.parse(req.body)
    const sets = []; const params = []; let idx = 1
    if (input.fullName !== undefined) { sets.push(`full_name = $${idx++}`); params.push(input.fullName) }
    if (input.departmentId !== undefined) { sets.push(`department_id = $${idx++}, department = (SELECT name FROM departments WHERE id = $${idx - 1})`); params.push(input.departmentId) }
    if (input.jobTitle !== undefined) { sets.push(`job_title = $${idx++}`); params.push(input.jobTitle) }
    if (input.managerId !== undefined) { sets.push(`manager_id = $${idx++}`); params.push(input.managerId) }
    if (input.performanceScore !== undefined) { sets.push(`performance_score = $${idx++}`); params.push(input.performanceScore) }
    if (input.competencyScore !== undefined) { sets.push(`competency_score = $${idx++}`); params.push(input.competencyScore) }
    if (input.learningProgress !== undefined) { sets.push(`learning_progress = $${idx++}`); params.push(input.learningProgress) }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' })
    params.push(req.params.id)
const { rows } = await query(`UPDATE employees SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params)
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
    await logActivity({ req, user: req.user, action: 'employee.update', category: 'employee', targetId: req.params.id, description: `${req.user.name} updated employee ${rows[0].full_name}`, details: { changedFields: Object.keys(input) } })
    res.json({ employee: rows[0] })
  } catch (error) { next(error) }
})

// POST /api/employees/:id/deactivate (HR only)
router.post('/:id/deactivate', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING *", [req.params.id])
if (!rows[0]) return res.status(404).json({ error: 'Active employee not found.' })
    await query('UPDATE users SET is_active = false WHERE employee_id = $1', [req.params.id])
    await logActivity({ req, user: req.user, action: 'employee.deactivate', category: 'employee', targetId: req.params.id, description: `${req.user.name} deactivated employee ${rows[0].full_name}` })
    res.json({ deactivated: true, employee: rows[0] })
  } catch (error) { next(error) }
})

// POST /api/employees/:id/reactivate (HR only)
router.post('/:id/reactivate', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE employees SET is_active = true, updated_at = NOW() WHERE id = $1 AND is_active = false RETURNING *", [req.params.id])
if (!rows[0]) return res.status(404).json({ error: 'Inactive employee not found.' })
    await query('UPDATE users SET is_active = true WHERE employee_id = $1', [req.params.id])
    await logActivity({ req, user: req.user, action: 'employee.reactivate', category: 'employee', targetId: req.params.id, description: `${req.user.name} reactivated employee ${rows[0].full_name}` })
    res.json({ reactivated: true, employee: rows[0] })
  } catch (error) { next(error) }
})

// GET /api/employees/:id/history — score history time-series
router.get('/:id/history', authorize('hr', 'operations_manager', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, performance_score, competency_score, learning_progress, recorded_at
      FROM score_history
      WHERE employee_id = $1
      ORDER BY recorded_at ASC
    `, [req.params.id])
    res.json({ history: rows })
  } catch (error) { next(error) }
})

export default router
