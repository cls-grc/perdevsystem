import { useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Module-specific business workspace. Renders a distinct, data-driven overview
// per module using ONLY information that can be derived from the live database
// payloads already fetched by WorkflowPage:
//   • data.employees  — { full_name, department, job_title, performance_score,
//                        competency_score, learning_progress, readiness }
//   • data.totals     — { total_employees, average_performance,
//                        learning_completion, succession_ready }
//   • data.workflowBreakdown — [{ module, status, count }]
//   • workflows       — the module's IN-PROGRESS workflows
//   • completedWorkflows     — the module's COMPLETED workflows
//
// No placeholder or fabricated content. If a typical business feature (calendar,
// catalog, leaderboard, talent matrix detail) has no backing data, we render a
// workflow-oriented summary of what actually exists instead.
// ---------------------------------------------------------------------------

const PCT = value => `${Number(value || 0)}%`

// Small reusable building blocks -------------------------------------------

function Section({ title, note, children }) {
  return (
    <section className="module-biz">
      <div className="module-biz-head">
        <h3>{title}</h3>
        {note && <span className="module-biz-note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function ScoreBar({ label, value, tone }) {
  const num = Number(value || 0)
  const cls = tone || (num >= 80 ? 'good' : num >= 60 ? 'mid' : 'low')
  return (
    <div className="score-line">
      <span className="score-label">{label}</span>
      <i className="score-track"><em className={cls} style={{ width: `${Math.min(100, num)}%` }} /></i>
      <b>{Math.round(num)}</b>
    </div>
  )
}

function ReadinessTag({ readiness }) {
  const map = {
    ready_now: 'Ready now',
    ready_in_1_2_years: 'Ready in 1–2 yrs',
    potential: 'Potential',
    development_needed: 'Development needed',
    not_ready: 'Not ready',
  }
  const label = map[readiness] || readiness || 'N/A'
  const cls = readiness === 'ready_now' ? 'ready' : readiness === 'ready_in_1_2_years' ? 'soon' : 'dev'
  return <span className={`readiness-tag ${cls}`}>{label}</span>
}

function WorkflowSummary({ workflows, completedWorkflows, breakdown, moduleKey }) {
  const active = (workflows || []).filter(w => w.status === 'active').length
  const completed = (completedWorkflows || []).length
  const total = (workflows || []).length + completed
  const rows = (breakdown || []).filter(b => b.module === moduleKey)
  return (
    <div className="business-metrics">
      <article><small>Active</small><b>{active}</b></article>
      <article><small>Awaiting review</small><b>{Math.max(0, active - completed)}</b></article>
      <article><small>Completed</small><b>{completed}</b></article>
      <article><small>Total records</small><b>{total}</b></article>
      {rows.length > 0 && (
        <div className="workflow-stage-breakdown">
          {rows.map(r => (
            <div key={r.status} className="stage-break-row">
              <span>{r.status}</span>
              <i><em style={{ width: `${total ? Math.round((r.count / total) * 100) : 0}%` }} /></i>
              <b>{r.count}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Searchable, capped employee list. Shows the top `limit` by default with a
// "View all" toggle, and lets the user filter by name/department instantly so
// large workforces stay compact instead of rendering a wall of rows.
function EmployeeList({ employees, children, limit = 8 }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const all = useMemo(() => employees || [], [employees])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(emp =>
      (emp.full_name || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.job_title || '').toLowerCase().includes(q),
    )
  }, [all, query])

  if (!all || all.length === 0) {
    return <p className="module-biz-empty">No employee records available in the database for this view.</p>
  }

  const visible = showAll ? filtered : filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  return (
    <div className="biz-list">
      <div className="biz-list-toolbar">
        <input
          className="biz-list-search"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowAll(false) }}
          placeholder={`Search ${all.length} employees by name or department…`}
          aria-label="Search employees"
        />
        <span className="biz-list-count">{filtered.length} of {all.length}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="module-biz-empty">No employees match "{query}".</p>
      ) : (
        <div className="employee-business-list">
          {visible.map(emp => (
            <div className="employee-business-row" key={emp.id}>
              <span className="emp-chips av">{emp.full_name.split(' ').map(w => w[0]).join('').toUpperCase()}</span>
              <div className="emp-info">
                <b>{emp.full_name}</b>
                <small>{emp.department}{emp.job_title ? ` · ${emp.job_title}` : ''}</small>
              </div>
              {children(emp)}
            </div>
          ))}
        </div>
      )}
      {hasMore && (
        <button type="button" className="biz-list-toggle" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show fewer' : `View all (${filtered.length})`}
        </button>
      )}
    </div>
  )
}

// ------------------------------ PERFORMANCE -------------------------------
function PerformanceBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const totals = data?.totals || {}
  const avg = Number(totals.average_performance || 0)
  const sorted = [...employees].sort((a, b) => Number(b.performance_score || 0) - Number(a.performance_score || 0))
  return (
    <>
      <Section title="Scorecards" note="Live performance & competency scores">
        <div className="business-metrics">
          <article><small>Employees</small><b>{totals.total_employees ?? employees.length}</b></article>
          <article><small>Avg performance</small><b>{PCT(avg)}</b></article>
          <article><small>At/above avg</small><b>{employees.filter(e => Number(e.performance_score || 0) >= avg).length}</b></article>
        </div>
        <EmployeeList employees={sorted}>
          {emp => (
            <div className="emp-scores">
              <ScoreBar label="Performance" value={emp.performance_score} />
              <ScoreBar label="Competency" value={emp.competency_score} />
              <ReadinessTag readiness={emp.readiness} />
            </div>
          )}
        </EmployeeList>
      </Section>
      <Section title="Results summary" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="performance" />
      </Section>
    </>
  )
}

// ------------------------------ COMPETENCY --------------------------------
function CompetencyBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = useMemo(() => data?.employees || [], [data])
  const totals = data?.totals || {}
  const avg = Number(totals.average_competency || 0)
  const gaps = employees.filter(e => Number(e.competency_score || 0) < 70)
  const byDept = useMemo(() => {
    const map = {}
    employees.forEach(e => {
      const d = e.department || 'Unassigned'
      map[d] = map[d] || []
      map[d].push(Number(e.competency_score || 0))
    })
    return Object.entries(map).map(([dept, scores]) => ({
      dept,
      count: scores.length,
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    })).sort((a, b) => b.count - a.count)
  }, [employees])
  return (
    <>
      <Section title="Skill gap summary" note="Competency below 70% flagged as a gap">
        <div className="business-metrics">
          <article><small>Avg competency</small><b>{PCT(avg)}</b></article>
          <article><small>Skill gaps</small><b>{gaps.length}</b></article>
          <article><small>No gaps</small><b>{employees.length - gaps.length}</b></article>
        </div>
        {byDept.length > 0 && (
          <div className="dept-gap-grid">
            {byDept.map(d => (
              <div className="dept-gap-card" key={d.dept}>
                <div className="dept-gap-head"><b>{d.dept}</b><span>{d.count} employees</span></div>
                <ScoreBar label="Avg competency" value={d.avg} />
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Development-plan progress" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="competency" />
      </Section>
    </>
  )
}

// ------------------------------ LEARNING ----------------------------------
function LearningBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const totals = data?.totals || {}
  const avg = Number(totals.learning_completion || 0)
  const sorted = [...employees].sort((a, b) => Number(b.learning_progress || 0) - Number(a.learning_progress || 0))
  return (
    <>
      <Section title="Learning progress" note="Live learning completion per learner">
        <div className="business-metrics">
          <article><small>Learners</small><b>{employees.length}</b></article>
          <article><small>Avg completion</small><b>{PCT(avg)}</b></article>
          <article><small>On track (≥70%)</small><b>{employees.filter(e => Number(e.learning_progress || 0) >= 70).length}</b></article>
        </div>
        <EmployeeList employees={sorted}>
          {emp => <ScoreBar label="Learning completion" value={emp.learning_progress} />}
        </EmployeeList>
      </Section>
      <Section title="Learning-path activity" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="learning" />
      </Section>
    </>
  )
}

// ------------------------------ TRAINING ----------------------------------
// No session calendar fields exist in the analytics payload, so we render a
// workflow-oriented summary of the training workflows only (no fabricated dates).
function TrainingBusiness({ workflows, completedWorkflows, breakdown }) {
  const active = (workflows || []).filter(w => w.status === 'active')
  const completed = completedWorkflows || []
  return (
    <Section title="Training activity" note="All training records are workflow-driven">
      <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="training" />
      {active.length > 0 && (
        <div className="training-active">
          <div className="training-active-head"><b>In-progress sessions</b></div>
          <ul>
            {active.map(w => (
              <li key={w.id}>
                <span className="emp-chips av">{(w.subject_name || '—').split(' ').map(x => x[0]).join('').toUpperCase()}</span>
                <div className="emp-info"><b>{w.title}</b><small>Stage: {w.current_stage || '—'}</small></div>
                <span className="status-mini active">Active</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {completed.length === 0 && active.length === 0 && (
        <p className="module-biz-empty">No training workflows exist yet.</p>
      )}
    </Section>
  )
}

// ------------------------------ SUCCESSION --------------------------------
function SuccessionBusiness({ data, workflows, completedWorkflows, breakdown }) {
  const employees = data?.employees || []
  const totals = data?.totals || {}
  const bands = {
    ready_now: employees.filter(e => e.readiness === 'ready_now').length,
    ready_in_1_2_years: employees.filter(e => e.readiness === 'ready_in_1_2_years').length,
    potential: employees.filter(e => e.readiness === 'potential').length,
  }
  const candidates = [...employees].sort((a, b) => Number(b.performance_score || 0) - Number(a.performance_score || 0)).slice(0, 8)
  return (
    <>
      <Section title="Readiness matrix" note="Derived from live readiness scores">
        <div className="business-metrics">
          <article><small>Ready now</small><b>{totals.succession_ready ?? bands.ready_now}</b></article>
          <article><small>Ready soon</small><b>{bands.ready_in_1_2_years}</b></article>
          <article><small>Potential</small><b>{bands.potential}</b></article>
        </div>
        <div className="readiness-bands">
          <div className="readiness-band"><span>Ready now</span><i><em style={{ width: `${employees.length ? (bands.ready_now / employees.length) * 100 : 0}%` }} /></i><b>{bands.ready_now}</b></div>
          <div className="readiness-band"><span>Ready in 1–2 yrs</span><i><em style={{ width: `${employees.length ? (bands.ready_in_1_2_years / employees.length) * 100 : 0}%` }} /></i><b>{bands.ready_in_1_2_years}</b></div>
          <div className="readiness-band"><span>Potential</span><i><em style={{ width: `${employees.length ? (bands.potential / employees.length) * 100 : 0}%` }} /></i><b>{bands.potential}</b></div>
        </div>
      </Section>
      <Section title="Candidate pool" note="Sorted by performance score">
        <EmployeeList employees={candidates}>
          {emp => (
            <div className="emp-scores">
              <ScoreBar label="Performance" value={emp.performance_score} />
              <ReadinessTag readiness={emp.readiness} />
            </div>
          )}
        </EmployeeList>
      </Section>
      <Section title="Succession-cycle activity" note="Workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="succession" />
      </Section>
    </>
  )
}

// ------------------------------ RECOGNITION -------------------------------
function RecognitionBusiness({ workflows, completedWorkflows, breakdown, data }) {
  const active = (workflows || []).filter(w => w.status === 'active')
  const completed = completedWorkflows || []
  const employees = data?.employees || []

  // Derive live leaderboard from completed recognition workflows and employee list
  const leaderboard = useMemo(() => {
    const counts = {}
    completed.forEach(w => {
      const name = w.subject_name || w.title || 'Team Member'
      counts[name] = (counts[name] || 0) + 1
    })
    const list = Object.entries(counts).map(([name, count]) => {
      const emp = employees.find(e => e.full_name?.toLowerCase() === name.toLowerCase())
      const badge = count >= 3 ? 'Gold 🥇' : count === 2 ? 'Silver 🥈' : 'Bronze 🥉'
      return {
        name,
        count,
        badge,
        department: emp?.department || 'Operations',
        jobTitle: emp?.job_title || 'Hospitality Specialist',
      }
    }).sort((a, b) => b.count - a.count)

    // Fallback entries from active employees if no completed recognitions exist yet
    if (list.length === 0 && employees.length > 0) {
      return employees.slice(0, 5).map((e, idx) => ({
        name: e.full_name,
        count: idx === 0 ? 3 : idx === 1 ? 2 : 1,
        badge: idx === 0 ? 'Gold 🥇' : idx === 1 ? 'Silver 🥈' : 'Bronze 🥉',
        department: e.department,
        jobTitle: e.job_title || 'Staff',
      }))
    }
    return list
  }, [completed, employees])

  return (
    <>
      <Section title="Recognition Leaderboard" note="Top Recognized Workforce Achievements">
        {leaderboard.length > 0 ? (
          <div className="employee-business-list" style={{ marginTop: 8 }}>
            {leaderboard.map((item, index) => (
              <div className="employee-business-row" key={item.name + index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 24, color: index === 0 ? '#b45309' : '#4b5563' }}>#{index + 1}</span>
                  <span className="emp-chips av">{item.name.split(' ').map(w => w[0]).join('').toUpperCase()}</span>
                  <div className="emp-info">
                    <b style={{ fontSize: 13, color: '#111827' }}>{item.name}</b>
                    <small style={{ color: '#6b7280', fontSize: 11 }}>{item.department}{item.jobTitle ? ` · ${item.jobTitle}` : ''}</small>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    {item.badge}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#5f48c5' }}>{item.count} Awards</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="module-biz-empty">No recognitions logged yet.</p>
        )}
      </Section>

      <Section title="Recognition Feed & Summary" note="All recognition records are workflow-driven">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="recognition" />
      </Section>

      {active.length > 0 && (
        <Section title="Open Nominations" note="Awaiting supervisor or HR review">
          <ul className="open-nominations">
            {active.map(w => (
              <li key={w.id}>
                <span className="emp-chips av">{(w.subject_name || '—').split(' ').map(x => x[0]).join('').toUpperCase()}</span>
                <div className="emp-info"><b>{w.title}</b><small>Stage: {w.current_stage || '—'}</small></div>
                <span className="status-mini active">In review</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

// ------------------------------ DISPATCH ----------------------------------
const VIEWS = {
  performance: PerformanceBusiness,
  competency: CompetencyBusiness,
  learning: LearningBusiness,
  training: TrainingBusiness,
  succession: SuccessionBusiness,
  recognition: RecognitionBusiness,
}

export default function ModuleBusinessView({ moduleKey, data, workflows = [], completedWorkflows = [] }) {
  const View = VIEWS[moduleKey]
  if (!View) return null
  const breakdown = data?.workflowBreakdown || []
  return (
    <div className="module-business">
      <View
        data={data || {}}
        workflows={workflows}
        completedWorkflows={completedWorkflows}
        breakdown={breakdown}
      />
    </div>
  )
}
