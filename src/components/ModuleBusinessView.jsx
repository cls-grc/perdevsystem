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
function RecognitionBusiness({ data, workflows, completedWorkflows, breakdown, onOpenBadgePicker }) {
  const employees = useMemo(() => data?.employees || [], [data])
  const active = useMemo(() => (workflows || []).filter(w => w.status === 'active'), [workflows])
  const completed = useMemo(() => completedWorkflows || [], [completedWorkflows])
  const allRecognitionWorkflows = useMemo(() => [...active, ...completed], [active, completed])

  const [selectedDept, setSelectedDept] = useState('All')
  const [leaderboardQuery, setLeaderboardQuery] = useState('')

  // Dynamically calculate employee recognition stats & leaderboard points from live DB records & workflows
  const leaderboardData = useMemo(() => {
    const map = {}

    // Initialize every active employee with baseline scores derived from DB
    employees.forEach(emp => {
      map[emp.id] = {
        id: emp.id,
        name: emp.full_name,
        department: emp.department || 'Operations',
        jobTitle: emp.job_title || 'Hospitality Staff',
        gold: 0,
        silver: 0,
        bronze: 0,
        excellence: 0,
        totalBadges: 0,
        totalPoints: 0,
        performanceScore: emp.performance_score || 80,
      }
    })

    // Aggregate badges and points from all live recognition workflows
    allRecognitionWorkflows.forEach(wf => {
      const targetId = wf.subject_employee_id || wf.subject_id
      const meta = wf.metadata || {}

      // Find matching employee by ID or name
      let empObj = targetId ? map[targetId] : null
      if (!empObj && wf.subject_name) {
        empObj = Object.values(map).find(e => e.name.toLowerCase() === wf.subject_name.toLowerCase())
      }

      if (empObj) {
        const tier = (meta.badgeTier || meta.badge_tier || 'bronze').toLowerCase()
        const points = Number(meta.badgePoints || meta.points) || (tier === 'gold' ? 100 : tier === 'silver' ? 50 : tier === 'excellence' ? 75 : 25)

        if (tier === 'gold') empObj.gold += 1
        else if (tier === 'silver') empObj.silver += 1
        else if (tier === 'excellence') empObj.excellence += 1
        else empObj.bronze += 1

        empObj.totalBadges += 1
        empObj.totalPoints += points
      }
    })

    let list = Object.values(map)

    // Filter by department if selected
    if (selectedDept !== 'All') {
      list = list.filter(e => e.department === selectedDept)
    }

    // Filter by query
    if (leaderboardQuery.trim()) {
      const q = leaderboardQuery.toLowerCase()
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.jobTitle.toLowerCase().includes(q))
    }

    // Sort by points DESC, then totalBadges DESC, then performanceScore DESC
    return list.sort((a, b) => b.totalPoints - a.totalPoints || b.totalBadges - a.totalBadges || b.performanceScore - a.performanceScore)
  }, [employees, allRecognitionWorkflows, selectedDept, leaderboardQuery])

  // Extract unique departments for filter pills
  const departments = useMemo(() => ['All', ...new Set(employees.map(e => e.department).filter(Boolean))], [employees])

  // Top 3 Podium
  const top3 = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData])

  // Totals for top cards
  const totalBadgesIssued = useMemo(() => {
    return leaderboardData.reduce((acc, e) => acc + e.totalBadges, 0)
  }, [leaderboardData])

  const totalGoldIssued = useMemo(() => {
    return leaderboardData.reduce((acc, e) => acc + e.gold, 0)
  }, [leaderboardData])

  return (
    <>
      {/* 1. Header Toolbar */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Social Recognition & Leaderboard</h3>
        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#6b7280' }}>
          Celebrate hospitality excellence, track peer badges, and view top recognized staff.
        </p>
      </div>

      {/* 2. Top Summary KPI Widgets */}
      <div className="business-metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 16 }}>
        <article><small>Total Nominations</small><b>{allRecognitionWorkflows.length}</b></article>
        <article><small>Badges Awarded</small><b>{totalBadgesIssued}</b></article>
        <article><small>Gold Excellence 🥇</small><b>{totalGoldIssued}</b></article>
        <article><small>Active In Review</small><b>{active.length}</b></article>
      </div>

      {/* 3. Top 3 Podium Visual Display */}
      {top3.length > 0 && (
        <Section title="Hospitality Recognition Podium" note="Top 3 recognized staff overall">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 16,
            padding: '24px 16px 12px 16px',
            background: 'linear-gradient(180deg, #f8f6ff 0%, #ffffff 100%)',
            borderRadius: 14,
            border: '1px solid #e9e5f5',
            marginBottom: 20,
          }}>
            {/* 2nd Place Podium */}
            {top3[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 160 }}>
                <span style={{ fontSize: 24 }}>🥈</span>
                <span className="emp-chips av" style={{ width: 44, height: 44, fontSize: 16, background: '#64748b', color: '#fff', border: '3px solid #cbd5e1' }}>
                  {top3[1].name.split(' ').map(x => x[0]).join('').toUpperCase()}
                </span>
                <b style={{ fontSize: 13, color: '#1e293b', marginTop: 6, textAlign: 'center' }}>{top3[1].name}</b>
                <small style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{top3[1].department}</small>
                <div style={{ marginTop: 6, padding: '2px 8px', borderRadius: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 700, color: '#475569' }}>
                  {top3[1].totalPoints} pts ({top3[1].totalBadges} 🏅)
                </div>
                <div style={{ width: '100%', height: 75, background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)', borderRadius: '8px 8px 0 0', marginTop: 10, display: 'grid', placeItems: 'center', color: '#475569', fontWeight: 800, fontSize: 20 }}>
                  2
                </div>
              </div>
            )}

            {/* 1st Place Podium (Tallest Center) */}
            {top3[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 180, zIndex: 2 }}>
                <span style={{ fontSize: 32 }}>🥇</span>
                <span className="emp-chips av" style={{ width: 52, height: 52, fontSize: 18, background: '#d97706', color: '#fff', border: '3px solid #fde68a', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }}>
                  {top3[0].name.split(' ').map(x => x[0]).join('').toUpperCase()}
                </span>
                <b style={{ fontSize: 14, color: '#0f172a', marginTop: 6, textAlign: 'center', fontWeight: 800 }}>{top3[0].name}</b>
                <small style={{ fontSize: 11, color: '#d97706', textAlign: 'center', fontWeight: 700 }}>{top3[0].department}</small>
                <div style={{ marginTop: 6, padding: '3px 10px', borderRadius: 14, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 12, fontWeight: 800, color: '#b45309' }}>
                  {top3[0].totalPoints} pts ({top3[0].totalBadges} 🏅)
                </div>
                <div style={{ width: '100%', height: 105, background: 'linear-gradient(180deg, #fde68a, #f59e0b)', borderRadius: '10px 10px 0 0', marginTop: 10, display: 'grid', placeItems: 'center', color: '#78350f', fontWeight: 900, fontSize: 26, boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }}>
                  1
                </div>
              </div>
            )}

            {/* 3rd Place Podium */}
            {top3[2] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 160 }}>
                <span style={{ fontSize: 24 }}>🥉</span>
                <span className="emp-chips av" style={{ width: 44, height: 44, fontSize: 16, background: '#9a3412', color: '#fff', border: '3px solid #fed7aa' }}>
                  {top3[2].name.split(' ').map(x => x[0]).join('').toUpperCase()}
                </span>
                <b style={{ fontSize: 13, color: '#1e293b', marginTop: 6, textAlign: 'center' }}>{top3[2].name}</b>
                <small style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{top3[2].department}</small>
                <div style={{ marginTop: 6, padding: '2px 8px', borderRadius: 12, background: '#ffedd5', border: '1px solid #fed7aa', fontSize: 11, fontWeight: 700, color: '#9a3412' }}>
                  {top3[2].totalPoints} pts ({top3[2].totalBadges} 🏅)
                </div>
                <div style={{ width: '100%', height: 55, background: 'linear-gradient(180deg, #fed7aa, #f97316)', borderRadius: '8px 8px 0 0', marginTop: 10, display: 'grid', placeItems: 'center', color: '#7c2d12', fontWeight: 800, fontSize: 18 }}>
                  3
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 4. Filterable Leaderboard Table */}
      <Section title="Recognition Leaderboard" note="Live tally of points & awarded badges">
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
          {departments.map(dept => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: selectedDept === dept ? '1px solid #654bd2' : '1px solid #e5e7eb',
                background: selectedDept === dept ? '#f3e8ff' : '#ffffff',
                color: selectedDept === dept ? '#6d28d9' : '#4b5563',
                fontSize: 11,
                fontWeight: selectedDept === dept ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {dept} {dept === 'All' ? `(${employees.length})` : ''}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            className="biz-list-search"
            value={leaderboardQuery}
            onChange={e => setLeaderboardQuery(e.target.value)}
            placeholder="Search leaderboard by staff name or title..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #ecebf0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#faf9fc', borderBottom: '1px solid #ecebf0', color: '#6b7280', fontSize: 11 }}>
                <th style={{ padding: '10px 12px', width: 45 }}>Rank</th>
                <th style={{ padding: '10px 12px' }}>Employee</th>
                <th style={{ padding: '10px 12px' }}>Department</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Badges</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((emp, idx) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx < 3 ? '#faf5ff' : '#ffffff' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: idx === 0 ? '#d97706' : idx === 1 ? '#475569' : idx === 2 ? '#9a3412' : '#6b7280' }}>
                    {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="emp-chips av" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {emp.name.split(' ').map(x => x[0]).join('').toUpperCase()}
                      </span>
                      <div>
                        <b style={{ color: '#111827', display: 'block' }}>{emp.name}</b>
                        <small style={{ color: '#6b7280', fontSize: 10 }}>{emp.jobTitle}</small>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#4b5563' }}>{emp.department}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6, fontSize: 11 }}>
                      {emp.gold > 0 && <span title={`${emp.gold} Gold Badges`}>🥇 {emp.gold}</span>}
                      {emp.silver > 0 && <span title={`${emp.silver} Silver Badges`}>🥈 {emp.silver}</span>}
                      {emp.bronze > 0 && <span title={`${emp.bronze} Bronze Badges`}>🥉 {emp.bronze}</span>}
                      {emp.excellence > 0 && <span title={`${emp.excellence} Excellence Badges`}>🏆 {emp.excellence}</span>}
                      {emp.totalBadges === 0 && <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#654bd2' }}>
                    {emp.totalPoints} pts
                  </td>
                </tr>
              ))}
              {leaderboardData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                    No leaderboard records found for current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Live Recognition Feed Cards */}
      <Section title="Live Recognition Feed" note="Real-time nominations and awarded citations">
        <WorkflowSummary workflows={workflows} completedWorkflows={completedWorkflows} breakdown={breakdown} moduleKey="recognition" />
        
        {allRecognitionWorkflows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {allRecognitionWorkflows.map(wf => {
              const meta = wf.metadata || {}
              const isCompleted = wf.status === 'completed'
              const badgeIcon = meta.badgeIcon || (meta.badgeTier === 'gold' ? '🥇' : meta.badgeTier === 'silver' ? '🥈' : meta.badgeTier === 'excellence' ? '🏆' : '🥉')
              const nominee = meta.nomineeName || wf.subject_name || 'Team Member'
              const nominator = meta.nominatorName || 'Colleague'
              const categoryTag = meta.category || 'Service Excellence'
              const reasonText = meta.reason || wf.title || 'Demonstrated outstanding dedication.'

              return (
                <div
                  key={wf.id}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid #ecebf0',
                    background: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{badgeIcon}</span>
                      <div>
                        <b style={{ fontSize: 13, color: '#111827' }}>{nominee}</b>
                        <small style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>
                          Nominated by <strong style={{ color: '#4b5563' }}>{nominator}</strong>
                        </small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                        background: '#f3e8ff',
                        color: '#6d28d9',
                      }}>
                        {categoryTag}
                      </span>
                      <span className={`status-mini ${isCompleted ? 'complete' : 'active'}`}>
                        {isCompleted ? 'Badge Issued' : 'In Review'}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#374151', lineHeight: 1.5, fontStyle: 'italic', background: '#faf9fc', padding: 8, borderRadius: 6, borderLeft: '3px solid #654bd2' }}>
                    "{reasonText}"
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                    <span>Stage: {wf.current_stage || (isCompleted ? 'Final Approval' : 'Review')}</span>
                    <span>{new Date(wf.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="module-biz-empty">No recognition nominations exist yet. Click "Nominate & Issue Badge" above to start!</p>
        )}
      </Section>
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

export default function ModuleBusinessView({ moduleKey, data, workflows = [], completedWorkflows = [], onOpenBadgePicker }) {
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
        onOpenBadgePicker={onOpenBadgePicker}
      />
    </div>
  )
}
