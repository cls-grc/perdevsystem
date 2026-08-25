import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Icon } from '../components/Sidebar'
import AnimatedNumber from '../components/AnimatedNumber'

const pct = value => `${Math.round(Number(value || 0))}%`
const getRole = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return undefined }
}

export default function RoleHome({ role, name }) {
  const navigate = useNavigate()
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
        cards = [
          ['Total employees', totals.total_employees ?? 0, 'Live count of active workforce records.', 'Live', 'users', 'purple'],
          ['Average performance', pct(performance), 'Organization-wide performance average.', 'Live', 'trend', 'emerald'],
          ['Learning completion', pct(learning), 'Average learning progress across employees.', 'Live', 'book', 'amber'],
          ['Succession ready', successionReady, 'Employees scoring in the ready-now band.', 'Live', 'crown', 'rose'],
        ]
      } else if (operationsManager) {
        const totals = dashboard?.totals || {}
        const certs = certData?.certificates || []
        const validCerts = certs.filter(c => c.status === 'issued').length
        const trainingCompleted = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'completed').reduce((s, w) => s + Number(w.count), 0)
        const trainingActive = (dashboard?.workflowBreakdown || []).filter(w => w.module === 'training' && w.status === 'active').reduce((s, w) => s + Number(w.count), 0)
        const trainingTotal = trainingCompleted + trainingActive
        const completionRate = trainingTotal ? Math.round((trainingCompleted / trainingTotal) * 100) : 0
        cards = [
          ['Operations overview', pct(totals.average_performance || 0), 'Live department performance average.', 'Live', 'trend', 'purple'],
          ['Certificate status', `${validCerts}/${certs.length || 0}`, 'Issued certificates out of total on record.', 'Live', 'award', 'cyan'],
          ['Training completion', trainingTotal ? pct(completionRate) : '—', 'Completed vs. total training workflows.', 'Live', 'calendar', 'amber'],
          ['Learning progress', pct(totals.learning_completion || 0), 'Live average learning progress.', 'Live', 'book', 'emerald'],
        ]
      } else if (supervisor) {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const activeCount = activeWorkflows.length
        const recognitionPending = workflows.filter(w => w.module === 'recognition' && w.status === 'active').length
        cards = [
          ['Team performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record', 'trend', 'purple'],
          ['Learning completion', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record', 'book', 'emerald'],
          ['Active workflows', activeCount, 'Workflows currently awaiting action.', 'Live', 'grid', 'cyan'],
          ['Recognition pending', recognitionPending, 'Recognition workflows in progress.', 'Live', 'heart', 'rose'],
        ]
      } else if (management) {
        const successionActive = workflows.filter(w => w.module === 'succession' && w.status === 'active').length
        const successionCompleted = completedWorkflows.filter(w => w.module === 'succession').length
        const readinessReady = readiness?.band === 'ready_now' ? 1 : 0
        cards = [
          ['Succession approvals', successionActive, 'Succession workflows awaiting approval.', 'Live', 'crown', 'purple'],
          ['Ready-now candidates', readinessReady, 'Your readiness band indicator.', 'Live', 'users', 'emerald'],
          ['Approved cycles', successionCompleted, 'Completed succession planning cycles.', 'Live', 'award', 'cyan'],
          ['Planning cycles', workflows.filter(w => w.module === 'succession').length, 'Total succession workflows on record.', 'Live', 'calendar', 'amber'],
        ]
      } else {
        const perf = myEmployee?.performance_score ?? null
        const learning = myEmployee?.learning_progress ?? null
        const competency = myEmployee?.competency_score ?? null
        const certs = certData?.certificates || []
        const myCerts = certs.filter(c => c.status === 'issued').length
        cards = [
          ['My performance', perf !== null ? pct(perf) : '—', 'Your recorded performance score.', perf !== null ? 'Live' : 'No record', 'trend', 'purple'],
          ['Learning progress', learning !== null ? pct(learning) : '—', 'Your recorded learning progress.', learning !== null ? 'Live' : 'No record', 'book', 'emerald'],
          ['Competency', competency !== null ? pct(competency) : '—', 'Your recorded competency score.', competency !== null ? 'Live' : 'No record', 'zap', 'cyan'],
          ['Certificates', myCerts, 'Certificates issued to you.', 'Live', 'award', 'rose'],
        ]
      }

      setData({ cards, workflows, activeWorkflows, completedWorkflows })
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [hr, operationsManager, supervisor, management, employee])

  useEffect(() => {
    void load()

    const handleSync = () => { void load() }
    window.addEventListener('pds:refresh-dashboard', handleSync)

    const interval = setInterval(() => { void load() }, 45000)
    return () => {
      window.removeEventListener('pds:refresh-dashboard', handleSync)
      clearInterval(interval)
    }
  }, [load])

  if (loading) {
    return (
      <main className="role-home saas-role-home">
        <div className="role-home-head" style={{ minHeight: 48, marginBottom: 20 }}>
          <div className="skeleton-bar" style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton-bar" style={{ width: 280, height: 26, borderRadius: 8 }} />
        </div>
        <section className="role-home-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton-bar" style={{ height: 140, borderRadius: 14 }} />
          ))}
        </section>
        <div className="skeleton-bar" style={{ height: 120, borderRadius: 14, marginTop: 24 }} />
      </main>
    )
  }

  const title = supervisor
    ? 'Team Development Dashboard'
    : management
      ? 'Leadership Dashboard'
      : operationsManager
        ? 'Operations Performance Dashboard'
        : 'My Development Dashboard'

  const description = supervisor
    ? 'Manage your team’s performance, learning, and workflow actions.'
    : management
      ? `Welcome back, ${name || 'Executive'}. Review succession plans awaiting senior management approval.`
      : operationsManager
        ? 'Monitor cross-functional operations performance, certifications, and training progress.'
        : `Welcome back, ${name || 'Team Member'}. Track your personal growth and development.`

  const nextTitle = supervisor ? 'Next team action' : management ? 'Next approval' : operationsManager ? 'Next monitoring action' : 'Next action'
  const nextDetail = supervisor
    ? 'Review outstanding performance submissions and help employees complete assigned learning.'
    : management
      ? 'Review proposed succession candidates and approve the finalized plan.'
      : operationsManager
        ? 'Monitor analytics and certificate status across the operation.'
        : 'Complete your current review step and continue your assigned learning activities.'

  const cardRoutes = {
    'Certificates': '/certificates',
    'Certificate status': '/certificates',
    'My performance': '/performance',
    'Team performance': '/performance',
    'Learning progress': '/learning',
    'Learning completion': '/learning',
    'Competency': '/competency',
    'Training completion': '/training',
    'Succession ready': '/succession',
    'Succession approvals': '/succession',
    'Operations overview': '/performance',
    'Approved cycles': '/succession',
    'Planning cycles': '/succession',
    'Total employees': '/employees',
    'Average performance': '/performance',
    'Active workflows': '/performance',
    'Recognition pending': '/recognition',
    'Ready-now candidates': '/succession',
  }

  const cards = data?.cards || []

  return (
    <main className="role-home saas-role-home">
      <div className="role-home-head">
        <div>
          <h1>{title}</h1>
          <p>
            {description}{' '}
            <span className="live-indicator" style={{ verticalAlign: 'middle', marginLeft: 6 }}>
              <span className="live-indicator-dot" />
              Live
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="role-home-error" role="alert">
          <p>{error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="role-home-grid">
        {cards.map(([label, value, detail, live, iconName = 'grid', colorTheme = 'purple']) => {
          const targetRoute = cardRoutes[label]
          return (
            <article
              key={label}
              onClick={targetRoute ? () => navigate(targetRoute) : undefined}
              className={`role-kpi-card card-${colorTheme}`}
              style={{ cursor: targetRoute ? 'pointer' : 'default' }}
              title={targetRoute ? `View ${label}` : undefined}
            >
              <div className="role-card-top">
                <div className={`role-icon-box ${colorTheme}-box`}>
                  <Icon name={iconName} size={18} />
                </div>
                <em className="role-live-chip">{live}</em>
              </div>
              <div className="role-card-body">
                <small>{label}</small>
                <b><AnimatedNumber value={value} /></b>
                <p>{detail}</p>
              </div>
              {targetRoute && (
                <div className="role-card-hover-hint">
                  <span>Explore module</span>
                  <Icon name="chevron" size={14} />
                </div>
              )}
            </article>
          )
        })}
      </section>

      {/* Next Priority Action Card */}
      <div className="role-home-action-banner">
        <div className="action-banner-icon">
          <Icon name="zap" size={20} />
        </div>
        <div className="action-banner-text">
          <h2>{nextTitle}</h2>
          <p>{nextDetail}</p>
        </div>
      </div>
    </main>
  )
}


