import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { authenticate } from '../middleware.js'
import { config } from '../config.js'

const router = Router()
router.use(authenticate)

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
})

/**
 * AI CHAT DATA PIPELINE & RBAC ENGINE
 * 
 * Pipeline:
 * User Question -> Authentication -> RBAC Check -> Determine Scope -> 
 * Retrieve Database Data -> Send Structured Data to AI -> Grounded Answer
 */
router.post('/', async (req, res, next) => {
  try {
    const { message, history } = chatSchema.parse(req.body || {})
    const { id: userId, role, employeeId } = req.user
    const textLower = message.toLowerCase()

    // -------------------------------------------------------------------------
    // STEP 1 & 2: RBAC CHECK & SCOPE DETERMINATION
    // -------------------------------------------------------------------------
    let userDepartment = null
    let employeeProfile = null

    if (employeeId) {
      try {
        const empRes = await query(
          'SELECT id, full_name, job_title, department, performance_score, competency_score, learning_progress FROM employees WHERE id=$1',
          [employeeId]
        )
        employeeProfile = empRes.rows[0] || null
        userDepartment = employeeProfile?.department || null
      } catch (err) {
        console.warn('[chat-route] Could not load user employee profile:', err.message)
      }
    }

    // Explicit Employee RBAC Guard:
    // If role is employee and they ask about coworkers or other departments, block immediately.
    const isCoworkerQuery = (
      textLower.includes('coworker') ||
      textLower.includes('colleague') ||
      textLower.includes('other employee') ||
      textLower.includes('highest performance') ||
      textLower.includes('top employee') ||
      textLower.includes('who had') ||
      textLower.includes('everyone') ||
      textLower.includes('organization') ||
      textLower.includes('department average')
    )

    if (role === 'employee' && isCoworkerQuery) {
      return res.json({
        answer: 'Authorization notice: As an employee, you are authorized to access only your own personal performance, competency, and learning records. Organizational and peer data is restricted to HR and management.',
        dataContextSummary: 'Access Blocked — Scope Violation',
        grounded: true,
      })
    }

    // Manager / Supervisor RBAC Scope check:
    const isSupervisorOrOpManager = role === 'supervisor' || role === 'operations_manager'
    if (isSupervisorOrOpManager && !userDepartment) {
      return res.status(403).json({ error: 'Your account requires an assigned department to use the AI assistant.' })
    }

    // -------------------------------------------------------------------------
    // STEP 3: DATABASE DATA RETRIEVAL (EXACT TABLE COLUMN SCHEMA)
    // -------------------------------------------------------------------------
    let employeeWhere = ''
    let queryParams = []

    if (role === 'employee') {
      employeeWhere = ' WHERE e.id = $1 '
      queryParams = [employeeId]
    } else if (isSupervisorOrOpManager) {
      employeeWhere = ' WHERE e.department = $1 '
      queryParams = [userDepartment]
    } else {
      // HR or Management — organization-wide
      employeeWhere = ' WHERE e.is_active = true '
      queryParams = []
    }

    const subWhereClause = role === 'employee' ? ' WHERE e.id = $1 ' : isSupervisorOrOpManager ? ' WHERE e.department = $1 ' : ''
    const subQueryParams = role === 'employee' ? [employeeId] : isSupervisorOrOpManager ? [userDepartment] : []

    // Safely query all database tables matching exact migrations schema
    // Training-specific scope: employees can only see their own training
    const trainingEmpJoin = role === 'employee'
      ? ' JOIN training_participants tp ON tp.session_id = ts.id AND tp.employee_id = $1'
      : isSupervisorOrOpManager
      ? ` AND (ts.department = $1 OR ts.department = 'All Departments')`
      : ''
    const trainingParams = role === 'employee' ? [employeeId] : isSupervisorOrOpManager ? [userDepartment] : []
    const trainingWhere = role === 'employee' ? 'WHERE 1=1' : 'WHERE 1=1'

    const [{ rows: employees }, { rows: gaps }, { rows: assignments }, { rows: resources }, { rows: succession }, { rows: trainingSessions }, { rows: trainingParticipants }] = await Promise.all([
      query(`
        SELECT e.id, e.full_name, e.job_title, e.department, e.performance_score, e.competency_score, e.learning_progress 
        FROM employees e
        ${employeeWhere}
        ORDER BY e.performance_score DESC
      `, queryParams).catch(() => ({ rows: [] })),
      
      query(`
        SELECT ca.competency, ca.score, ca.required_score, (ca.required_score - ca.score) AS gap,
               e.full_name, e.department
        FROM competency_assessments ca
        JOIN employees e ON ca.employee_id = e.id
        ${subWhereClause}
        ORDER BY gap DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      query(`
        SELECT lr.title AS resource_title, la.status, la.progress, (la.status = 'completed' OR la.progress >= 100) AS is_completed, la.due_date,
               e.full_name, e.department
        FROM learning_assignments la
        JOIN learning_resources lr ON la.resource_id = lr.id
        JOIN employees e ON la.employee_id = e.id
        ${subWhereClause}
        ORDER BY la.assigned_at DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      query(`
        SELECT id, title, category, duration_hours, provider
        FROM learning_resources
        WHERE is_active = true
        ORDER BY title ASC
      `).catch(() => ({ rows: [] })),

      query(`
        SELECT sp.readiness_band, sp.readiness_score, e.full_name, e.department, e.job_title
        FROM succession_profiles sp
        JOIN employees e ON sp.employee_id = e.id
        ${subWhereClause}
        ORDER BY sp.readiness_score DESC
      `, subQueryParams).catch(() => ({ rows: [] })),

      // Training Management: formal instructor-led sessions (separate from learning)
      query(
        role === 'employee'
          ? `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               tp.attendance, tp.evaluation_score
             FROM training_sessions ts
             JOIN training_participants tp ON tp.session_id = ts.id
             WHERE tp.employee_id = $1
             ORDER BY ts.start_date DESC LIMIT 20`
          : isSupervisorOrOpManager
          ? `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               COUNT(tp.id)::int AS total_invited,
               COUNT(tp.id) FILTER (WHERE tp.attendance IN ('present','late'))::int AS attended,
               COUNT(tp.id) FILTER (WHERE tp.attendance = 'absent')::int AS absent
             FROM training_sessions ts
             LEFT JOIN training_participants tp ON tp.session_id = ts.id
             WHERE (ts.department = $1 OR ts.department = 'All Departments')
             GROUP BY ts.id ORDER BY ts.start_date DESC LIMIT 20`
          : `SELECT ts.id, ts.title, ts.category, ts.trainer, ts.venue, ts.start_date, ts.end_date, ts.status, ts.department,
               COUNT(tp.id)::int AS total_invited,
               COUNT(tp.id) FILTER (WHERE tp.attendance IN ('present','late'))::int AS attended,
               COUNT(tp.id) FILTER (WHERE tp.attendance = 'absent')::int AS absent
             FROM training_sessions ts
             LEFT JOIN training_participants tp ON tp.session_id = ts.id
             GROUP BY ts.id ORDER BY ts.start_date DESC LIMIT 30`,
        trainingParams
      ).catch(() => ({ rows: [] })),

      // Training participants summary (for HR/manager)
      role !== 'employee'
        ? query(
            isSupervisorOrOpManager
              ? `SELECT e.full_name, e.department, ts.title AS session_title, tp.attendance, tp.evaluation_score
                 FROM training_participants tp
                 JOIN employees e ON e.id = tp.employee_id
                 JOIN training_sessions ts ON ts.id = tp.session_id
                 WHERE e.department = $1
                 ORDER BY ts.start_date DESC LIMIT 40`
              : `SELECT e.full_name, e.department, ts.title AS session_title, tp.attendance, tp.evaluation_score
                 FROM training_participants tp
                 JOIN employees e ON e.id = tp.employee_id
                 JOIN training_sessions ts ON ts.id = tp.session_id
                 ORDER BY ts.start_date DESC LIMIT 40`,
            isSupervisorOrOpManager ? [userDepartment] : []
          ).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ])

    // Calculate aggregated metrics for grounded context
    const avgPerf = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.performance_score) || 0), 0) / employees.length) : 0
    const avgComp = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.competency_score) || 0), 0) / employees.length) : 0
    const avgLearn = employees.length ? Math.round(employees.reduce((acc, e) => acc + (Number(e.learning_progress) || 0), 0) / employees.length) : 0
    const readyNowCount = succession.filter(s => s.readiness_band === 'ready_now').length
    const completedTrainings = trainingSessions.filter(ts => ts.status === 'completed').length
    const scheduledTrainings = trainingSessions.filter(ts => ts.status === 'scheduled').length

    const dataContext = {
      userRole: role,
      userScope: role === 'employee' ? 'self_only' : isSupervisorOrOpManager ? `department_${userDepartment}` : 'organization_wide',
      currentUser: employeeProfile ? employeeProfile.full_name : 'System User',
      metrics: {
        totalEmployees: employees.length,
        averagePerformance: avgPerf,
        averageCompetency: avgComp,
        averageLearningProgress: avgLearn,
        successionReadyNowCount: readyNowCount,
        totalLearningResources: resources.length,
        totalTrainingSessions: trainingSessions.length,
        completedTrainingSessions: completedTrainings,
        scheduledTrainingSessions: scheduledTrainings,
      },
      employees: employees.map(e => ({
        name: e.full_name,
        role: e.job_title,
        department: e.department,
        performanceScore: `${e.performance_score}%`,
        competencyScore: `${e.competency_score}%`,
        learningProgress: `${e.learning_progress}%`,
      })),
      topCompetencyGaps: gaps.slice(0, 10).map(g => ({
        employee: g.full_name,
        competency: g.competency,
        currentScore: `${g.score}%`,
        targetScore: `${g.required_score}%`,
        gap: `${g.gap}%`,
        department: g.department,
      })),
      incompleteLearningActivities: assignments.filter(a => !a.is_completed).map(a => ({
        employee: a.full_name,
        course: a.resource_title,
        progress: `${a.progress}%`,
        status: a.status,
        department: a.department,
      })),
      learningResourcesLibrary: resources.map(r => ({
        title: r.title,
        category: r.category,
        durationHours: r.duration_hours,
        provider: r.provider || 'Internal',
      })),
      successionPipeline: succession.map(s => ({
        employee: s.full_name,
        jobTitle: s.job_title,
        department: s.department,
        readinessBand: s.readiness_band,
        readinessScore: `${s.readiness_score}%`,
      })),
      // TRAINING MANAGEMENT: Instructor-led formal training sessions (NOT the same as Learning)
      trainingSessions: trainingSessions.map(ts => ({
        title: ts.title,
        category: ts.category,
        trainer: ts.trainer || 'TBD',
        venue: ts.venue,
        startDate: ts.start_date,
        endDate: ts.end_date,
        status: ts.status,
        department: ts.department,
        ...(role === 'employee'
          ? { myAttendance: ts.attendance, myEvaluationScore: ts.evaluation_score }
          : { totalInvited: ts.total_invited, attended: ts.attended, absent: ts.absent }),
      })),
      trainingParticipantRecords: trainingParticipants.slice(0, 30).map(tp => ({
        employee: tp.full_name,
        department: tp.department,
        session: tp.session_title,
        attendance: tp.attendance,
        evaluationScore: tp.evaluation_score,
      })),
    }

    // Filter conversation history to avoid duplicating current user message
    const filteredHistory = history
      .filter(h => !(h.role === 'user' && h.content === message))
      .slice(-4)

    // -------------------------------------------------------------------------
    // STEP 4: AI GENERATION WITH STRICT GROUNDING IN DATABASE DATA
    // -------------------------------------------------------------------------
    let answerText = ''

    if (config.openRouterApiKey) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openRouterApiKey}`,
            'HTTP-Referer': config.clientOrigin,
            'X-Title': 'PerDevSys AI Assistant',
          },
          body: JSON.stringify({
            model: config.openRouterModel,
            messages: [
              {
                role: 'system',
                content: `You are the database-grounded AI Assistant for PerDevSys (Performance & Capability Development System).
STRICT GROUNDING RULES:
1. You MUST ONLY answer using the authorized database records provided in the context below.
2. NEVER fabricate employee names, performance scores, courses, gaps, or succession bands.
3. If data is not present in the provided JSON context, explicitly state: "Based on available system records, that information is not recorded in the database."
4. Always respect the user's scope (${dataContext.userScope}).
5. Distinguish between current scores and target scores when explaining competency gaps.
6. Provide direct, helpful, professional responses formatted cleanly with Markdown.
7. Always format bold headings, action labels, and item titles using double asterisks (e.g. **Action Steps**, **Identify Learning Needs:**).
8. When the user asks to list or show employees (e.g. "list employees under my department", "who are my department employees", "list employees"), list each employee individually with their full name, job title, department, performance score, competency score, and learning progress. Do NOT summarize into just a total count.

CRITICAL MODULE DISAMBIGUATION — READ CAREFULLY:
- "Training Management" or "Training" refers EXCLUSIVELY to formal, instructor-led training sessions (found in the 'trainingSessions' key of the context). These are scheduled events with trainers, venues, dates, and attendance tracking.
- "Learning" or "Learning Management" refers EXCLUSIVELY to self-paced digital learning assignments and resources (found in the 'incompleteLearningActivities' and 'learningResourcesLibrary' keys).
- When the user asks about training, workshops, sessions, attendance, or trainers → use ONLY data from 'trainingSessions' and 'trainingParticipantRecords'.
- When the user asks about learning, e-learning, courses, course completion, or learning progress → use ONLY data from 'incompleteLearningActivities' and 'learningResourcesLibrary'.
- NEVER mix training session data with learning resource data in the same answer unless explicitly asked to compare them.`
              },
              {
                role: 'system',
                content: `AUTHORIZED DATABASE CONTEXT (JSON):\n${JSON.stringify(dataContext, null, 2)}`
              },
              ...filteredHistory,
              { role: 'user', content: message }
            ],
            temperature: 0.2,
            max_tokens: 600,
          }),
        })

        if (response.ok) {
          const payload = await response.json()
          answerText = payload?.choices?.[0]?.message?.content || ''
        } else {
          console.warn('[chat-route] OpenRouter status:', response.status, await response.text().catch(() => ''))
        }
      } catch (llmErr) {
        console.warn('[chat-route] OpenRouter API call failed, using deterministic grounding:', llmErr.message)
      }
    }

    // Fallback Grounded Generator (when API key is absent, invalid, or offline)
    if (!answerText) {
      answerText = generateGroundedFallback(message, dataContext)
    }

    res.json({
      answer: answerText,
      dataContextSummary: `${dataContext.employees.length} employee record(s) in scope (${dataContext.userScope})`,
      grounded: true,
    })

  } catch (error) {
    console.error('[chat-route-error]', error)
    next(error)
  }
})

/**
 * Deterministic Grounded Generator for offline / demo environments
 */
function generateGroundedFallback(prompt, ctx) {
  const p = prompt.toLowerCase()
  const empList = ctx.employees || []
  const gaps = ctx.topCompetencyGaps || []
  const learning = ctx.incompleteLearningActivities || []
  const resources = ctx.learningResourcesLibrary || []
  const succession = ctx.successionPipeline || []

  // List employees under department / scope
  const isEmployeeListQuery = (
    p.includes('list employee') ||
    p.includes('list the employee') ||
    p.includes('list of employee') ||
    p.includes('show employee') ||
    p.includes('show the employee') ||
    p.includes('department employee') ||
    p.includes('under my department') ||
    p.includes('in my department') ||
    p.includes('who are the employee') ||
    p.includes('who is in my department') ||
    p.includes('who works') ||
    p.includes('my team') ||
    p.includes('team member') ||
    p.includes('my staff') ||
    p.includes('employee list') ||
    (p.includes('employee') && (p.includes('list') || p.includes('show') || p.includes('who') || p.includes('all')))
  )

  if (isEmployeeListQuery) {
    if (!empList.length) {
      return `Based on available database records, no employee records were found for your authorized scope (**${ctx.userScope}**).`
    }
    const items = empList.map(e => `• **${e.name}** — ${e.role} (${e.department}) · Performance: ${e.performanceScore} · Competency: ${e.competencyScore} · Learning: ${e.learningProgress}`).join('\n')
    const scopeLabel = ctx.userScope.startsWith('department_')
      ? `department (**${ctx.userScope.replace('department_', '')}**)`
      : `authorized scope (**${ctx.userScope}**)`
    return `Based on current authorized database records, here ${empList.length === 1 ? 'is the 1 employee' : `are the ${empList.length} employees`} under your ${scopeLabel}:\n\n${items}`
  }

  // Highest performance
  if (p.includes('highest performance') || p.includes('top performance') || p.includes('best score')) {
    if (!empList.length) return 'Based on available records, no employee performance data is present in your scope.'
    const top = empList[0]
    return `Based on current database records, **${top.name}** (${top.role} · ${top.department}) has the highest recorded performance score at **${top.performanceScore}**.`
  }

  // Department largest gap / average
  if (p.includes('largest competency gap') || p.includes('department gap') || p.includes('competency gap') || p.includes('priority')) {
    if (!gaps.length) return 'Based on available records, no active competency gaps are currently detected across assessed employees.'
    const topGap = gaps[0]
    return `Based on available competency records, the largest skill gap is detected for **${topGap.employee}** (${topGap.department}) in **${topGap.competency}** with a gap of **${topGap.gap}** (Current: ${topGap.currentScore}, Target: ${topGap.targetScore}). Across all records, the average competency level is **${ctx.metrics.averageCompetency}%**.`
  }

  // Incomplete learning activities
  if (p.includes('incomplete learning') || p.includes('learning activities') || p.includes('unfinished course') || p.includes('need to complete')) {
    if (!learning.length) return 'Based on available learning records, there are currently no incomplete learning activities recorded for your authorized scope.'
    const items = learning.slice(0, 5).map(l => `• **${l.employee}**: "${l.course}" (${l.progress} complete, Status: ${l.status})`).join('\n')
    return `Based on available database records, the following incomplete learning activities were found:\n\n${items}`
  }

  // Ready Now succession
  if (p.includes('ready now') || p.includes('succession ready') || p.includes('successor')) {
    const readyNow = succession.filter(s => s.readinessBand === 'ready_now')
    if (!readyNow.length) return 'Based on current succession records, there are no employees currently categorized in the **Ready Now** band.'
    const items = readyNow.map(s => `• **${s.employee}** (${s.jobTitle} · ${s.department}) — Readiness Score: ${s.readinessScore}`).join('\n')
    return `Based on current database records, there ${readyNow.length === 1 ? 'is 1 employee' : `are ${readyNow.length} employees`} in the **Ready Now** succession band:\n\n${items}`
  }

  // Learning resources
  if (p.includes('learning resource') || p.includes('course') || p.includes('customer service')) {
    const csResources = resources.filter(r => 
      r.category.toLowerCase().includes('customer service') ||
      r.title.toLowerCase().includes('customer service')
    )
    const count = csResources.length
    if (p.includes('customer service')) {
      if (count === 0) return 'There are currently 0 learning resources related to Customer Service in the available system records.'
      const items = csResources.map(r => `• **${r.title}** (${r.durationHours || 2} hrs, Provider: ${r.provider})`).join('\n')
      return `There are currently **${count}** learning resources related to Customer Service in the available system records:\n\n${items}`
    }
    return `The system currently contains **${resources.length}** learning resources in the database library.`
  }

  // Personal score query (for employee)
  if (p.includes('my last performance') || p.includes('my performance') || p.includes('my score') || p.includes('my competency') || p.includes('my record')) {
    if (!empList.length) return 'No employee record found for your account.'
    const self = empList[0]
    return `Based on your official system records:\n\n• **Employee**: ${self.name}\n• **Role**: ${self.role} (${self.department})\n• **Performance Score**: ${self.performanceScore}\n• **Competency Score**: ${self.competencyScore}\n• **Learning Progress**: ${self.learningProgress}`
  }

  // General grounded summary fallback
  return `Based on current authorized database records (${ctx.userScope}):\n\n• **Monitored Employees**: ${ctx.metrics.totalEmployees}\n• **Average Performance**: ${ctx.metrics.averagePerformance}%\n• **Average Competency**: ${ctx.metrics.averageCompetency}%\n• **Learning Completion**: ${ctx.metrics.averageLearningProgress}%\n• **Succession Ready Now**: ${ctx.metrics.successionReadyNowCount} employee(s)\n\nYou can ask specific questions about top performance, skill gaps, learning activities, or succession readiness.`
}

export default router
