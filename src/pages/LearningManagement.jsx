import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import ModuleAIInsights from '../components/ModuleAIInsights'
import '../learningLibrary.css'

const CATEGORIES = ['Leadership', 'Customer Service', 'Food Safety', 'Kitchen Operations', 'Compliance', 'Communication', 'Sales', 'Technical Skills']
const PROV_TYPES = ['internal', 'external']

// Self-reported study statuses.
const STUDY_STATUSES = [
  ['not_started', 'Not started'],
  ['studying', 'Studying'],
  ['completed', 'Completed'],
  ['need_help', 'Need help'],
]

const STATUS_LABELS = Object.fromEntries(STUDY_STATUSES)
const STATUS_PILL = {
  not_started: 'status not-started',
  studying: 'status studying',
  completed: 'status completed',
  need_help: 'status need-help',
}

function initials(name = '') {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
}

export default function LearningManagement() {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const hr = role === 'hr'
  const supervisor = role === 'supervisor'
  const canManage = hr
  const canAssign = hr || supervisor
  const employee = role === 'employee'

  const [resources, setResources] = useState([])
  const [employees, setEmployees] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [assignments, setAssignments] = useState([])
  const [completions, setCompletions] = useState([])

  const [tab, setTab] = useState('library')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [provType, setProvType] = useState('')
  const [compFilter, setCompFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal', durationHours: '', objectives: '', url: '', competencies: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Assign flow
  const [assignResource, setAssignResource] = useState(null)
  const [assignIds, setAssignIds] = useState([])
  const [dueDate, setDueDate] = useState('')

  // Completion flow (HR/supervisor official verification)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [assessmentNote, setAssessmentNote] = useState('')
  const [assessmentPass, setAssessmentPass] = useState('Pass')

  const load = async () => {
    try {
      const calls = []
      if (!employee) {
        calls.push(api.learningResources(showArchived ? { includeArchived: true } : {}), api.learningAssignments(), api.workflowSubjects())
      } else {
        calls.push(api.learningResources(), api.learningAssignments(), api.learningCompletions())
      }
      calls.push(api.learningCompetencies())
      const results = await Promise.all(calls)
      setResources(results[0].resources || [])
      setAssignments(results[1].assignments || [])
      if (employee) {
        setCompletions(results[2].completions || [])
      } else {
        setEmployees(results[2].employees || [])
        setCompletions([])
        const comps = await api.learningCompletions().catch(() => ({ completions: [] }))
        setCompletions(comps.completions || [])
      }
      setCompetencies(results[results.length - 1].competencies || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  useEffect(() => { load() }, [showArchived])

  // Module stats for the metrics strip (matches other modules' live widgets).
  const moduleStats = useMemo(() => [
    ['Courses in library', resources.filter(r => r.is_active !== false).length],
    ['Assigned', assignments.length],
    ['Confirmed completions', completions.length],
    ['Need help', assignments.filter(a => a.status === 'need_help').length],
  ], [resources, assignments, completions])

  const filtered = useMemo(() => {
    return resources.filter(r => {
      const text = `${r.title} ${r.description} ${r.provider || ''} ${r.category || ''} ${(r.competencies || []).join(' ')}`.toLowerCase()
      const matchQ = !query || text.includes(query.toLowerCase())
      const matchC = !category || r.category === category
      const matchP = !provType || r.provider_type === provType
      const matchComp = !compFilter || (r.competencies || []).includes(compFilter)
      return matchQ && matchC && matchP && matchComp
    })
  }, [resources, query, category, provType, compFilter])

  const save = async event => {
    event.preventDefault()
    try {
      const data = { ...form, durationHours: form.durationHours ? Number(form.durationHours) : null }
      const result = editing
        ? await api.updateLearningResource(editing.id, data)
        : await api.createLearningResource(data)
      setResources(items => editing
        ? items.map(i => i.id === result.resource.id ? result.resource : i)
        : [result.resource, ...items])
      setShowForm(false); setEditing(null)
      setNotice(editing ? 'Course updated.' : 'Course added to the library.')
    } catch (requestError) { setError(requestError.message) }
  }

  const editResource = resource => {
    setForm({
      title: resource.title, description: resource.description, category: resource.category,
      provider: resource.provider || '', providerType: resource.provider_type || 'internal',
      durationHours: resource.duration_hours || '', objectives: resource.objectives || '',
      url: resource.url || '', competencies: resource.competencies || [],
    })
    setEditing(resource); setShowForm(true)
  }

  const archive = async resource => {
    if (!window.confirm(`Archive "${resource.title}"? It will be hidden from the library.`)) return
    try { await api.archiveLearningResource(resource.id); setResources(items => items.filter(i => i.id !== resource.id)); setNotice('Course archived.') }
    catch (requestError) { setError(requestError.message) }
  }

  const assign = async () => {
    if (!assignResource || !assignIds.length) return setError('Select a course and at least one employee.')
    try {
      await api.assignLearning({ resourceId: assignResource.id, employeeIds: assignIds, dueDate: dueDate || null })
      setNotice(`Assigned "${assignResource.title}" to ${assignIds.length} employee(s).`)
      setAssignResource(null); setAssignIds([]); setDueDate('')
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (requestError) { setError(requestError.message) }
  }

  // Self-reported progress/status update — employees, HR and supervisors.
  const updateAssignment = async (assignment, patch) => {
    try {
      const merged = { progress: assignment.progress || 0, status: assignment.status || 'not_started', ...patch }
      await api.updateLearningProgress(assignment.id, merged.progress)
      if (merged.status !== assignment.status) await api.updateLearningStatus(assignment.id, merged.status)
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (requestError) { setError(requestError.message) }
  }

  const updateProgress = (assignment, progress) => updateAssignment(assignment, { progress })

  const updateStatus = (assignment, status) => updateAssignment(assignment, { status })

  const recordCompletion = async () => {
    if (!completeTarget) return
    try {
      await api.recordLearningCompletion({
        resourceId: completeTarget.resource_id,
        employeeId: completeTarget.employee_id,
        assessment: { result: assessmentPass, note: assessmentNote, recordedAt: new Date().toISOString() },
      })
      setNotice(`Completion verified for "${completeTarget.resource_title}".`)
      setCompleteTarget(null); setAssessmentNote(''); setAssessmentPass('Pass')
      const [assignResult, compResult] = await Promise.all([api.learningAssignments(), api.learningCompletions()])
      setAssignments(assignResult.assignments || [])
      setCompletions(compResult.completions || [])
    } catch (requestError) { setError(requestError.message) }
  }

  const completedIds = useMemo(() => new Set(completions.map(c => `${c.resource_id}:${c.employee_id}`)), [completions])

  const resourcesForAssign = resources.filter(r => r.is_active !== false)

  return <main className="module-workspace learning-workspace">
    <div className="module-heading">
      <div>
        <h1>Course Library</h1>
        <p>Curate legitimate learning resources, assign them to employees, and track self-reported study progress.</p>
      </div>
      {canManage && <div className="module-heading-actions"><button className="module-primary" type="button" onClick={() => { setForm({ title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal', durationHours: '', objectives: '', url: '', competencies: [] }); setEditing(null); setShowForm(true) }}>Add course</button></div>}
    </div>

    {notice && <div className="module-notice"><span>✓ {notice}</span><button type="button" className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    {/* Module metrics strip — consistent with other modules */}
    <section className="module-metrics">
      {moduleStats.map(([label, value], index) => <article key={label}><span>{index + 1}</span><div><small>{label}</small><b>{value}</b><em>Live database value</em></div></article>)}
    </section>

    <nav className="learning-tabs" aria-label="Learning views">
      {[['library', 'Course Library'], ['assign', 'Assign Courses'], ['progress', 'My Progress'], ['gaps', '🎯 Skill Gap Assignments'], ['completions', 'Verified Completions'], ['ai', 'AI Insights']].map(([key, label]) => (
        <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
      ))}
    </nav>

    {tab === 'library' && (
      <section className="learning-section">
        <div className="learning-toolbar">
          <label className="learning-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses, providers, competencies…" aria-label="Search courses" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear">×</button>}</label>
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={provType} onChange={e => setProvType(e.target.value)} aria-label="Filter provider type"><option value="">All sources</option><option value="internal">Internal</option><option value="external">External</option></select>
          <select value={compFilter} onChange={e => setCompFilter(e.target.value)} aria-label="Filter competency"><option value="">All competencies</option>{competencies.map(c => <option key={c}>{c}</option>)}</select>
          {canManage && <label className="learning-archived"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>}
        </div>
        <div className="course-grid">
          {filtered.map(resource => <article className="course-card" key={resource.id}>
            <div className="course-top">
              <span className={`course-badge ${resource.provider_type}`}>{resource.provider_type === 'internal' ? 'Internal' : 'External'}</span>
              <span className="course-category">{resource.category}</span>
            </div>
            <h3>{resource.title}</h3>
            <p className="course-provider"><b>{resource.provider || (resource.provider_type === 'internal' ? 'Company training' : 'External provider')}</b>{resource.duration_hours ? ` · ${resource.duration_hours}h` : ''}</p>
            <p className="course-desc">{resource.description}</p>
            {resource.objectives && <div className="course-objectives"><b>Objectives</b><ul>{resource.objectives.split(';').filter(Boolean).map((o, i) => <li key={i}>{o.trim()}</li>)}</ul></div>}
            {(resource.competencies || []).length > 0 && <div className="course-tags">{resource.competencies.map(c => <span key={c}>{c}</span>)}</div>}
            {resource.url && <a className="course-link" href={resource.url} target="_blank" rel="noreferrer">Open resource ↗</a>}
            <div className="course-stats">
              <span>{resource.assigned_count || 0} assigned</span>
              <span>{resource.completed_count || 0} completed</span>
            </div>
            {canManage && resource.is_active !== false && (
              <div className="course-actions">
                <button onClick={() => editResource(resource)}>Edit</button>
                <button className="danger" onClick={() => archive(resource)}>Archive</button>
              </div>
            )}
          </article>)}
          {!filtered.length && <div className="learning-empty">No courses {query || category || provType || compFilter ? 'match your filters' : 'in the library yet'}.</div>}
        </div>
      </section>
    )}

    {tab === 'assign' && (
      <section className="learning-section">
        {canAssign ? <>
          <div className="assign-layout">
            <div className="assign-col">
              <h2>1 · Select a course</h2>
              <div className="assign-courses">
                {resourcesForAssign.map(r => <button key={r.id} className={`assign-course ${assignResource?.id === r.id ? 'selected' : ''}`} onClick={() => setAssignResource(r)}>
                  <b>{r.title}</b><small>{r.category}{r.provider ? ` · ${r.provider}` : ''}</small>
                </button>)}
                {!resourcesForAssign.length && <p className="learning-empty">Add courses to the library first.</p>}
              </div>
            </div>
            <div className="assign-col">
              <h2>2 · Select employees</h2>
              <div className="assign-emp-search">
                {employees.filter(p => `${p.full_name} ${p.department} ${p.job_title}`.toLowerCase().includes(query.toLowerCase())).map(p => <label className="assign-row" key={p.id}>
                  <input type="checkbox" checked={assignIds.includes(p.id)} onChange={() => setAssignIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />
                  <span className="assign-avatar">{initials(p.full_name)}</span>
                  <div><b>{p.full_name}</b><small>{p.job_title} · {p.department}</small></div>
                </label>)}
              </div>
            </div>
            <div className="assign-col">
              <h2>3 · Confirm assignment</h2>
              <label>Due date (optional)<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
              <div className="assign-summary">
                <p><b>Course:</b> {assignResource ? assignResource.title : '—'}</p>
                <p><b>Employees:</b> {assignIds.length}</p>
              </div>
              <button className="module-primary" onClick={assign} disabled={!assignResource || !assignIds.length}>Assign course</button>
            </div>
          </div>
        </> : <div className="learning-empty">Only HR and supervisors can assign courses.</div>}
      </section>
    )}

    {tab === 'progress' && (
      <section className="learning-section">
        <h2 className="learning-block-title">{employee ? 'My learning assignments' : 'Learning assignments & study status'}</h2>
        {!employee && <div className="completion-note"><b>Live status badges</b><p>Each assignment shows the employee's self-reported study status (Not started / Studying / Completed / Need help) and their progress. "Need help" is highlighted so you can follow up quickly.</p></div>}
        <div className="assignment-list">
          {assignments.map(a => <article className="assignment-row" key={a.id}>
<div className="assignment-info">
              <b>{a.resource_title}</b>
              <small>{employee ? a.category : `${a.employee_name} · ${a.department}`}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
              <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || 'Not started'}</span>
              {a.is_completed && <span className="pill verified">✓ Verified</span>}
              {a.fromCompetencyGap && <span className="pill gap-sourced" title="Assigned from a detected competency gap">🎯 From competency gap</span>}
            </div>
            <div className="assignment-progress">
              <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
              <span>{a.progress || 0}%</span>
            </div>

            {/* Employee self-report controls */}
            {!a.is_completed && employee && (
              <div className="assignment-actions">
                <label className="assignment-status-select">
                  Status
                  <select value={a.status || 'not_started'} onChange={e => updateStatus(a, e.target.value)}>
                    {STUDY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="assignment-progress-input">Progress <input type="range" min="0" max="100" value={a.progress || 0} onChange={e => updateProgress(a, Number(e.target.value))} /></label>
              </div>
            )}

            {/* HR/supervisor controls */}
            {!a.is_completed && !employee && (
              <label className="assignment-progress-input">Set progress <input type="range" min="0" max="100" value={a.progress || 0} onChange={e => updateProgress(a, Number(e.target.value))} /></label>
            )}
            {!a.is_completed && canAssign && (
              <button className="module-secondary small" onClick={() => setCompleteTarget(a)}>Verify completion</button>
            )}
          </article>)}
          {!assignments.length && <div className="learning-empty">No assignments yet.</div>}
        </div>
      </section>
    )}

    {tab === 'gaps' && (() => {
      // Gap-sourced assignments: those whose course carries at least one competency tag.
      const gapAssignments = assignments.filter(a => (a.competencies || []).length > 0)
      const gapVerified = completions.filter(c =>
        gapAssignments.some(a => a.resource_id === c.resource_id && a.employee_id === c.employee_id)
      ).length
      const gapActive = gapAssignments.filter(a => !a.is_completed).length
      return (
        <section className="learning-section">
          <div className="completion-note">
            <b>Skill Gap Assignments</b>
            <p>These courses were assigned directly from detected competency skill gaps. Verifying completion here triggers a +10 pt improvement on the linked competency score.</p>
          </div>

          {/* Gap summary strip */}
          <section className="module-metrics" style={{ marginBottom: 16 }}>
            {[
              ['Gap assignments', gapAssignments.length],
              ['In progress / not started', gapActive],
              ['Verified completions', gapVerified],
            ].map(([label, val], i) => (
              <article key={label}><span>{i + 1}</span><div><small>{label}</small><b>{val}</b><em>Live value</em></div></article>
            ))}
          </section>

          <div className="assignment-list">
            {gapAssignments.map(a => (
              <article className="assignment-row" key={a.id}>
                <div className="assignment-info">
                  <b>{a.resource_title}</b>
                  <small>{employee ? '' : `${a.employee_name} · ${a.department} · `}{a.category}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
                  {/* Competency tags — shows which gap this closes */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {(a.competencies || []).map(c => (
                      <span key={c} className="pill gap-sourced" title={`Closes gap in ${c}`}>🎯 {c}</span>
                    ))}
                  </div>
                  <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || 'Not started'}</span>
                  {a.is_completed && <span className="pill verified">✓ Verified — competency improved</span>}
                </div>
                <div className="assignment-progress">
                  <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
                  <span>{a.progress || 0}%</span>
                </div>
                {!a.is_completed && canAssign && (
                  <button className="module-secondary small" onClick={() => setCompleteTarget(a)}>Verify completion</button>
                )}
              </article>
            ))}
            {!gapAssignments.length && (
              <div className="learning-empty">No skill-gap assignments yet. Assign a course from a detected gap in <b>Competency Management → Skill Gaps &amp; Learning</b>.</div>
            )}
          </div>
        </section>
      )
    })()}

    {tab === 'completions' && (
      <section className="learning-section">
        <div className="completion-note">
          <b>Verified completions only</b>
          <p>An employee is only shown as completing a course when HR or a supervisor records an official completion in the database. Self-reported "Completed" status alone does not count as verified.</p>
        </div>
        <div className="completion-list">
          {completions.map(c => <article className="completion-row" key={c.id}>
            <span className="assign-avatar">{initials(c.employee_name)}</span>
            <div><b>{c.resource_title}</b><small>{c.employee_name} · {c.department}</small></div>
            <span className="completion-date">Completed {new Date(c.completed_at).toLocaleDateString()}</span>
            {c.assessment_result && c.assessment_result.result && <span className={`pill ${c.assessment_result.result === 'Pass' ? 'complete' : 'fail'}`}>{c.assessment_result.result}</span>}
          </article>)}
          {!completions.length && <div className="learning-empty">No verified completions recorded yet.</div>}
        </div>
      </section>
    )}


    {tab === 'ai' && (
      <section className="learning-section">
        <ModuleAIInsights module="learning" stage="completed" workflowId={null} />
      </section>
    )}

    {showForm && (
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Course form" onClick={() => { setShowForm(false); setEditing(null) }}>
        <form onSubmit={save} className="schedule-dialog learning-form" onClick={event => event.stopPropagation()}>
          <div className="learning-modal-head">
            <div><h2>{editing ? 'Edit course' : 'Add course to library'}</h2><p>Describe the learning resource, its provider, and which competencies it supports.</p></div>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}>×</button>
          </div>
          <div className="learning-fields">
            <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
            <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Provider / source<input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="e.g. TESDA, Internal Training, Coursera" /></label>
            <label>Provider type<select value={form.providerType} onChange={e => setForm({ ...form, providerType: e.target.value })}>{PROV_TYPES.map(t => <option key={t} value={t}>{t === 'internal' ? 'Internal' : 'External'}</option>)}</select></label>
            <label>Duration (hours)<input type="number" min="0" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} /></label>
            <label>URL / reference<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
            <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></label>
            <label className="full">Learning objectives<textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} placeholder="Separate objectives with semicolons (;)" /></label>
            <div className="full learning-competencies-block">
              <b>Related competencies</b>
              <div className="comp-picker">
                {competencies.map(c => <label key={c} className={form.competencies.includes(c) ? 'selected' : ''}><input type="checkbox" checked={form.competencies.includes(c)} onChange={() => setForm(s => ({ ...s, competencies: s.competencies.includes(c) ? s.competencies.filter(x => x !== c) : [...s.competencies, c] }))} />{c}</label>)}
                {!competencies.length && <small>No competencies available yet.</small>}
              </div>
            </div>
          </div>
          <div className="module-actions">
            <button type="button" className="module-secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</button>
            <button className="module-primary">{editing ? 'Save changes' : 'Add course'}</button>
          </div>
        </form>
      </div>
    )}

    {completeTarget && (
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Verify completion" onClick={() => setCompleteTarget(null)}>
        <div className="schedule-dialog learning-form" onClick={event => event.stopPropagation()}>
          <div className="learning-modal-head">
            <div><h2>Verify completion</h2><p>Officially record "{completeTarget.resource_title}" as completed for {completeTarget.employee_name}.</p></div>
            <button type="button" onClick={() => setCompleteTarget(null)}>×</button>
          </div>
          <div className="learning-fields">
            <label>Assessment result<select value={assessmentPass} onChange={e => setAssessmentPass(e.target.value)}><option>Pass</option><option>Fail</option><option>Incomplete</option></select></label>
            <label className="full">Assessment notes<textarea value={assessmentNote} onChange={e => setAssessmentNote(e.target.value)} placeholder="Optional notes about the assessment outcome" /></label>
          </div>
          <div className="module-actions">
            <button type="button" className="module-secondary" onClick={() => setCompleteTarget(null)}>Cancel</button>
            <button className="module-primary" onClick={recordCompletion}>Confirm verification</button>
          </div>
        </div>
      </div>
    )}
  </main>
}

