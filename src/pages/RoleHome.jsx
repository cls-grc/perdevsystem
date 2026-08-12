import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const pct = value => `${Math.round(Number(value || 0))}%`
const getRole = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return undefined }
}

export default function RoleHome({ role, name }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const userRole = role || getRole()
  const supervisor = userRole === 'supervisor'
  const management = userRole === 'management'
  const operationsManager = userRole === 'operations_manager'
  const hr = userRole === 'hr'
  const employee = userRole === 'employee'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const calls = []
      // HR & operations_manager can access the full dashboard analytics.
      if (hr || operationsManager) calls.push(api.analytics().catch(() => null))
      // Everyone with an employee record can see their own analytics.
      if (supervisor || management || employee || operationsManager) calls.push(api.analyticsMe().catch(() => null))
      // Workflow statistics relevant to the role.
      calls.push(api.workflows().catch(() => ({ workflows: [], total: 0 })))
      // Certificates for operations_manager & employee.
      if (operationsManager || employee) calls.push(api.certificates().catch(() => ({ certificates: [] })))

      const results = await Promise.all(calls)
      let index = 0
      const dashboard = (hr || operationsManager) ? results[index++] : null
      const me = (supervisor || management || employee || operationsManager) ? results[index++] : null
      const workflowData = results[index++] || { workflows: [], total: 0 }
      const certData = (operationsManager || employee) ? results[index++] : null

      const workflows = workflowData.workflows || []
      const activeWorkflows = workflows.filter(w => w.status === 'active')
      const completedWorkflows = workflows.filter(w => w.status === 'completed')
      const myEmployee = me?.employee || null
      const readiness = me?.readiness || null

      // Derive live cards per role.
      let cards = []
      if (hr) {
        const totals = dashboard?.totals || {}
        const performance = Math.round(Number(totals.average_performance || 0))
        const learning = Math.round(Number(totals.learning_completion || 0))
        const successionReady = Number(totals.succession_ready || 0)
        const activeReviewCount = (dashboard?.workflowBreakdown || []).filter(w => w.status === 'active').reduce((s, w) => s + Number(w.count), 0)
        cards = [
          ['Total employees', totals.total_employees ?? 0, 'Live count of active workforce records.', 'Live'],
          ['Average performance', pct(performance), 'Organization-wide performance average.', 'Live'],
          ['Learning completion', pct(learning), 'Average learning progress across employees.', 'Live'],
          ['Succession ready', successionReady, 'Employees scoring in the ready-now band.', 'Live'],
        ]
      } else if (operationsManager) {
        const totals = dashboard?.totals || {}
        const certs = certData?.certificates || []
        const issued = certs.filter(c => c.status === 'issued').length
        const validCerts = certs.filter(c => c.status === 'issued').length
        const trainingCompleted = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'completed').reduce((s, w) => s + Number(w.count), 0)
        const trainingActive = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'active').reduce((s, w) => s + Number(w.count), 0)
        const trainingTotal = trainingCompleted + trainingActive
        const completionRate = trainingTotal ? Math.round((trainingCompleted / trainingTotal) * 100) : 0
        cards = [
          ['Operations overview', pct(totals.average_performance || 0), 'Live department performance average.', 'Live'],
          ['Certificate status', `${validCerts}/${certs.length || 0}`, 'Issued certificates out of total on record.', 'Live'],
          ['Training completion', trainingTotal ? pct(completionRate) : '—', 'Completed vs. total training workflows.', 'Live'],
          ['Learning progress', pct(totals.learning_completion || 0), 'Live average learning progress.', 'Live'],
        ]
      } else if (supervisor) {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const activeCount = activeWorkflows.length
        const recognitionPending = workflows.filter(w => w.module === 'recognition' && w.status === 'active').length
        cards = [
          ['Team performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record'],
          ['Learning completion', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record'],
          ['Active workflows', activeCount, 'Workflows currently awaiting action.', 'Live'],
          ['Recognition pending', recognitionPending, 'Recognition workflows in progress.', 'Live'],
        ]
      } else if (management) {
        const successionActive = workflows.filter(w => w.module === 'succession' && w.status === 'active').length
        const successionCompleted = completedWorkflows.filter(w => w.module === 'succession').length
        const readinessReady = readiness?.band === 'ready_now' ? 1 : 0
        cards = [
          ['Succession approvals', successionActive, 'Succession workflows awaiting approval.', 'Live'],
          ['Ready-now candidates', readinessReady, 'Your readiness band indicator.', 'Live'],
          ['Approved cycles', successionCompleted, 'Completed succession planning cycles.', 'Live'],
          ['Planning cycles', workflows.filter(w => w.module === 'succession').length, 'Total succession workflows on record.', 'Live'],
        ]
      } else {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const competency = myEmployee?.competency_score ?? null
        const certs = certData?.certificates || []
        const myCerts = certs.filter(c => c.status === 'issued').length
        cards = [
          ['My performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record'],
          ['Learning progress', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record'],
          ['Competency', competency !== null ? pct(competency) : '—', 'Your recorded competency score.', competency !== null ? 'Live' : 'No record'],
          ['Certificates', myCerts, 'Certificates issued to you.', 'Live'],
        ]
      }

      setData({ cards, workflows, activeWorkflows, completedWorkflows })
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [hr, operationsManager, supervisor, management, employee])

  useEffect(() => { void load() }, [load])


  if (loading) {
    return <main className="role-home"><div><h1>Loading dashboard…</h1><p>Fetching live workforce data.</p></div><div className="role-home-skeleton">{[0, 1, 2, 3].map(i => <i key={i} />)}</div></main>
  }

  const title = supervisor ? 'Team Development Dashboard' : management ? 'Leadership Dashboard' : operationsManager ? 'Operations Performance Dashboard' : 'My Development Dashboard'
  const description = supervisor
    ? 'Manage your team’s performance, learning, and workflow actions.'
    : management
      ? `Welcome back, ${name}. Review succession plans awaiting senior management approval.`
      : operationsManager
        ? 'Monitor cross-functional operations performance, certifications, and training progress.'
        : `Welcome back, ${name}. Track your personal growth and development.`
  const nextTitle = supervisor ? 'Next team action' : management ? 'Next approval' : operationsManager ? 'Next monitoring action' : 'Next action'
  const nextDetail = supervisor
    ? 'Review outstanding performance submissions and help employees complete assigned learning.'
    : management
      ? 'Review proposed succession candidates and approve the finalized plan.'
      : operationsManager
        ? 'Monitor analytics and certificate status across the operation.'
        : 'Complete your current review step and continue your assigned learning activities.'

  const cards = data?.cards || []

  return <main className="role-home">
    <div><h1>{title}</h1><p>{description}</p></div>
    {error && <div className="role-home-error" role="alert"><p>{error}</p><button onClick={load}>Retry</button></div>}
    <section>
      {cards.map(([label, value, detail, live]) => <article key={label}><small>{label}</small><b>{value}</b><p>{detail}</p><em className="role-live">{live}</em></article>)}
    </section>
    <div className="role-home-action"><h2>{nextTitle}</h2><p>{nextDetail}</p></div>
  </main>
}

