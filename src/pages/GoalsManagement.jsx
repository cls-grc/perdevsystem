 import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const getRole = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return undefined }
}

const categoryPill = {
  personal: 'gf-pill-personal',
  performance: 'gf-pill-performance',
  learning: 'gf-pill-learning',
  career: 'gf-pill-career',
}

const statusLabel = {
  active: 'Active',
  pending_approval: 'Pending approval',
  completed: '✓ Completed',
  cancelled: '✕ Cancelled',
}

const initials = name => name?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || ''

const emptyForm = { employeeId: '', title: '', description: '', category: 'personal', objective: '', dueDate: '', keyResults: [] }

const emptyKR = { title: '', target: 100, current: 0 }

/** Mirror of the backend auto-calc so the UI can show a live preview. */
const progressFromKR = (krs) => {
  if (!krs || !krs.length) return 0
  const sum = krs.reduce((acc, kr) => {
    const target = Number(kr.target) || 0
    const current = Number(kr.current) || 0
    return acc + (target > 0 ? Math.min(100, (current / target) * 100) : 0)
  }, 0)
  return Math.round(sum / krs.length)
}

export default function GoalsManagement() {
  const role = getRole()
  const [goals, setGoals] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [history, setHistory] = useState([])
  const [historyGoal, setHistoryGoal] = useState(null)
  const [verifyDialog, setVerifyDialog] = useState(null) // goal object
  const [rejectDialog, setRejectDialog] = useState(null) // goal object
  const [cancelDialog, setCancelDialog] = useState(null) // goal object
  const [verifyComment, setVerifyComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filter) params.status = filter
      const [goalResult, empResult] = await Promise.all([
        api.goals(params),
        api.employees().catch(() => ({ employees: [] })),
      ])
      setGoals(goalResult.goals || [])
      setEmployees(empResult.employees || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const openHistory = async (goal) => {
    setHistoryGoal(goal)
    setHistory([])
    try {
      const result = await api.goalHistory(goal.id)
      setHistory(result.history || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSave = async () => {
    setError('')
    setNotice('')
    try {
      const payload = {
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        keyResults: form.keyResults.filter(kr => kr.title.trim()).map(kr => ({
          title: kr.title.trim(),
          target: Number(kr.target) || 0,
          current: Number(kr.current) || 0,
        })),
      }
      if (editGoal) {
        await api.updateGoal(editGoal.id, payload)
        setNotice('Goal updated successfully.')
      } else {
        await api.createGoal(payload)
        setNotice('Goal created successfully.')
      }
      setShowForm(false)
      setEditGoal(null)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleEdit = (goal) => {
    setEditGoal(goal)
    setForm({
      employeeId: goal.employee_id,
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      objective: goal.objective || '',
      dueDate: goal.due_date ? goal.due_date.slice(0, 16) : '',
      keyResults: Array.isArray(goal.key_results) ? goal.key_results.map(kr => ({ title: kr.title, target: Number(kr.target), current: Number(kr.current) })) : [],
    })
    setShowForm(true)
  }

  const handleProgress = async (goal, delta) => {
    const current = Number(goal.progress) || 0
    const newProgress = Math.min(100, Math.max(0, current + delta))
    setError('')
    setNotice('')
    try {
      await api.updateGoal(goal.id, { progress: newProgress })
      if (newProgress >= 100) {
        setNotice('Progress reached 100% — this goal now awaits admin approval.')
      } else {
        setNotice('Progress updated.')
      }
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.deleteGoal(id)
      setNotice('Goal cancelled.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleVerify = async () => {
    setError('')
    setNotice('')
    try {
      await api.verifyGoal(verifyDialog.id, verifyComment)
      setNotice('Goal verified and marked as completed.')
      setVerifyDialog(null)
      setVerifyComment('')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return setError('Provide a rejection reason.')
    setError('')
    setNotice('')
    try {
      await api.rejectGoal(rejectDialog.id, rejectReason.trim())
      setNotice('Goal rejected and returned to Active.')
      setRejectDialog(null)
      setRejectReason('')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const updateKR = (index, field, value) => {
    setForm(prev => {
      const krs = prev.keyResults.map((kr, i) => i === index ? { ...kr, [field]: value } : kr)
      return { ...prev, keyResults: krs }
    })
  }

  const canManage = ['hr', 'supervisor'].includes(role)
  const active = goals.filter(g => g.status === 'active')
  const pending = goals.filter(g => g.status === 'pending_approval')
  const completed = goals.filter(g => g.status === 'completed')
  const avgProgress = goals.length ? Math.round(goals.reduce((s, g) => s + (Number(g.progress) || 0), 0) / goals.length) : 0
  const krPreview = form.keyResults.length ? progressFromKR(form.keyResults) : null

  if (loading) return <main className="module-workspace"><div className="dashboard-skeleton"><i /><i /><i /><i /></div></main>

  return (
    <main className="module-workspace">
      <div className="module-heading">
        <div>
          <h1>Goals & OKRs</h1>
          <p>Set, track, verify, and complete personal and professional development goals.</p>
        </div>
        <div className="module-heading-actions">
          {canManage && <button className="module-primary" onClick={() => { setEditGoal(null); setForm(emptyForm); setShowForm(true) }}>New goal</button>}
        </div>
      </div>

      {notice && <div className="module-notice">✓ {notice}</div>}
      {error && <div className="module-error" role="alert">{error}</div>}

      <section className="gf-kpis">
        <article><small>Total goals</small><b>{goals.length}</b><em className="gf-kpi-accent">All records</em></article>
        <article><small>Active</small><b>{active.length}</b><em>In progress</em></article>
        <article><small>Pending approval</small><b>{pending.length}</b><em>Awaiting verify</em></article>
        <article><small>Completed</small><b>{completed.length}</b><em>✓ Achieved</em></article>
      </section>

      <div className="gf-tabs">
        <button className={`gf-tab ${filter === '' ? 'gf-tab-active' : ''}`} onClick={() => setFilter('')}>All</button>
        <button className={`gf-tab ${filter === 'active' ? 'gf-tab-active' : ''}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`gf-tab ${filter === 'pending_approval' ? 'gf-tab-active' : ''}`} onClick={() => setFilter('pending_approval')}>Pending approval ({pending.length})</button>
        <button className={`gf-tab ${filter === 'completed' ? 'gf-tab-active' : ''}`} onClick={() => setFilter('completed')}>Completed</button>
      </div>

      <section className="gf-list">
        {goals.length === 0 ? (
          <div className="gf-empty">
            <b>No goals found</b>
            <p>{canManage ? 'Create a new goal to get started.' : 'Your goals will appear here once set by HR or your supervisor.'}</p>
          </div>
        ) : goals.map(goal => {
          const liveProgress = progressFromKR(goal.key_results)
          const progressDisplay = goal.key_results && goal.key_results.length ? liveProgress : (Number(goal.progress) || 0)
          const hasKRs = Array.isArray(goal.key_results) && goal.key_results.length > 0
          return (
            <article key={goal.id} className="gf-card">
              <div className="gf-card-head">
                <div>
                  <h3 className="gf-card-title">{goal.title}</h3>
                  <small className="gf-card-sub">
                    {goal.employee_name} · {goal.category}
                    {goal.due_date && ` · Due ${new Date(goal.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </small>
                </div>
                <span className={`gf-pill ${categoryPill[goal.category] || 'gf-pill-personal'}`}>{goal.category}</span>
              </div>

              {goal.objective && <p className="gf-objective">{goal.objective}</p>}

              <div className="gf-progress">
                <div className="gf-progress-row">
                  <span>Progress</span>
                  <span><strong>{progressDisplay}%</strong>{hasKRs ? ' · auto from key results' : ''}</span>
                </div>
                <div className="gf-progress-track">
                  <div className={`gf-progress-fill ${goal.status === 'completed' ? 'done' : ''}`} style={{ width: `${progressDisplay}%` }} />
                </div>
              </div>

              {hasKRs && (
                <div className="gf-kr-list">
                  {goal.key_results.map((kr, i) => {
                    const pct = Math.min(100, Math.round(((Number(kr.current) || 0) / (Number(kr.target) || 100)) * 100))
                    return (
                      <div key={i} className="gf-kr">
                        <span>{kr.title}</span>
                        <span className="gf-kr-track"><i style={{ width: `${pct}%` }} /></span>
                        <b>{Number(kr.current) || 0}/{Number(kr.target) || 0}</b>
                      </div>
                    )
                  })}
                </div>
              )}

              {goal.status === 'pending_approval' && (
                <div className="gf-fb-row" style={{ marginTop: 12, background: '#fef3c7', border: '1px solid #fcd34d' }}>
                  <b>⏳ Awaiting verification:</b> This goal reached 100% and requires an admin/supervisor to confirm the result is genuine before it is marked completed.
                </div>
              )}

              {goal.status === 'active' && goal.rejection_reason && (
                <div className="gf-fb-row" style={{ marginTop: 12, background: '#fff0ed', border: '1px solid #fecaca' }}>
                  <b>⚠ Rejected:</b> {goal.rejection_reason}
                </div>
              )}

              {goal.status === 'completed' && goal.verified_by_name && (
                <div className="gf-fb-row" style={{ marginTop: 12, background: '#e5f7ec', border: '1px solid #bbf7d0' }}>
                  <b>✓ Verified by {goal.verified_by_name}</b>
                  {goal.verified_comment ? ` — ${goal.verified_comment}` : ''}
                  {goal.verified_at ? ` · ${new Date(goal.verified_at).toLocaleString()}` : ''}
                </div>
              )}

              <div className="gf-card-foot">
                <span className={`gf-status ${goal.status}`}>{statusLabel[goal.status] || goal.status}</span>
                <div className="gf-card-owner"><span className="er-avatar">{initials(goal.employee_name)}</span><span>{goal.employee_name}</span></div>
                <button className="module-secondary" onClick={() => openHistory(goal)}>History</button>
                {goal.status === 'active' && (
                  <>
                    <button className="module-secondary" onClick={() => handleProgress(goal, -10)}>−10%</button>
                    <button className="module-primary" onClick={() => handleProgress(goal, 10)}>+10%</button>
                  </>
                )}
                {goal.status === 'pending_approval' && canManage && (
                  <>
                    <button className="module-primary" onClick={() => { setVerifyDialog(goal); setVerifyComment('') }}>✓ Verify</button>
                    <button className="cancel-button" onClick={() => { setRejectDialog(goal); setRejectReason('') }}>Reject</button>
                  </>
                )}
                {canManage && goal.status === 'active' && (
                  <>
                    <button className="module-secondary" onClick={() => handleEdit(goal)}>Edit</button>
                    <button className="cancel-button" onClick={() => handleDelete(goal.id)}>Cancel</button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </section>

      {showForm && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => { setShowForm(false); setEditGoal(null) }}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()}>
            <h2 className="gf-dialog-title">{editGoal ? 'Edit goal' : 'New goal'}</h2>
            <p className="gf-dialog-sub">Set an OKR or development goal for an employee. Progress is auto-calculated from Key Results.</p>
            <label>Employee
              <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </label>
            <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Improve customer satisfaction score" /></label>
            <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" /></label>
            <label>Category
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="personal">Personal</option>
                <option value="performance">Performance</option>
                <option value="learning">Learning</option>
                <option value="career">Career</option>
              </select>
            </label>
            <label>Objective<textarea value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} placeholder="The main objective" /></label>

            <div style={{ marginTop: 14 }}>
              <div className="gf-dialog-sub" style={{ margin: '0 0 8px', fontWeight: 600 }}>Key Results <small>(progress = average of KR completion)</small></div>
              {form.keyResults.map((kr, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 34px', gap: 8, marginBottom: 8 }}>
                  <input value={kr.title} onChange={e => updateKR(i, 'title', e.target.value)} placeholder="Key result title" />
                  <input type="number" value={kr.target} onChange={e => updateKR(i, 'target', e.target.value)} placeholder="Target" />
                  <input type="number" value={kr.current} onChange={e => updateKR(i, 'current', e.target.value)} placeholder="Current" />
                  <button type="button" className="cancel-button" onClick={() => setForm(prev => ({ ...prev, keyResults: prev.keyResults.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button type="button" className="module-secondary" onClick={() => setForm(prev => ({ ...prev, keyResults: [...prev.keyResults, { ...emptyKR }] }))}>+ Add key result</button>
              {krPreview !== null && (
                <p style={{ fontSize: 10, color: '#5f48c4', marginTop: 8, fontWeight: 600 }}>Auto progress preview: {krPreview}%</p>
              )}
            </div>

            <label>Due date<input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
            <div className="module-actions">
              <button className="cancel-button" onClick={() => { setShowForm(false); setEditGoal(null) }}>Cancel</button>
              <button className="module-primary" onClick={handleSave} disabled={!form.employeeId || !form.title}>{editGoal ? 'Update' : 'Create'}</button>
            </div>
          </section>
        </div>
      )}

      {verifyDialog && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setVerifyDialog(null)}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()}>
            <h2 className="gf-dialog-title">Verify goal completion</h2>
            <p className="gf-dialog-sub">Confirm that <strong>{verifyDialog.employee_name}</strong> genuinely achieved: <em>{verifyDialog.title}</em></p>
            {verifyDialog.key_results && verifyDialog.key_results.length > 0 && (
              <div className="gf-fb-rows">
                {verifyDialog.key_results.map((kr, i) => {
                  const pct = Math.min(100, Math.round(((Number(kr.current) || 0) / (Number(kr.target) || 100)) * 100))
                  return <div key={i} className="gf-fb-row"><b>{kr.title}:</b> {Number(kr.current) || 0}/{Number(kr.target) || 0} ({pct}%)</div>
                })}
              </div>
            )}
            <label>Verification comment (optional)<textarea value={verifyComment} onChange={e => setVerifyComment(e.target.value)} placeholder="e.g. Verified against submitted KPI evidence." /></label>
            <div className="module-actions">
              <button className="cancel-button" onClick={() => setVerifyDialog(null)}>Cancel</button>
              <button className="module-primary" onClick={handleVerify}>Approve & complete</button>
            </div>
          </section>
        </div>
      )}

      {rejectDialog && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setRejectDialog(null)}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()}>
            <h2 className="gf-dialog-title">Reject goal completion</h2>
            <p className="gf-dialog-sub">Return <strong>{rejectDialog.employee_name}</strong>'s goal to Active with a required reason.</p>
            <label>Rejection reason<textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Evidence does not yet support 100% completion." /></label>
            <div className="module-actions">
              <button className="cancel-button" onClick={() => setRejectDialog(null)}>Cancel</button>
              <button className="module-primary" onClick={handleReject} disabled={!rejectReason.trim()}>Reject goal</button>
            </div>
          </section>
        </div>
      )}

      {historyGoal && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setHistoryGoal(null)}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()}>
            <h2 className="gf-dialog-title">Progress history</h2>
            <p className="gf-dialog-sub">Audit trail for: <em>{historyGoal.title}</em></p>
            {history.length === 0 ? (
              <div className="gf-empty"><b>No history yet</b><p>Progress changes will appear here.</p></div>
            ) : (
              <div className="gf-fb-rows">
                {history.map(entry => (
                  <div key={entry.id} className="gf-fb-row">
                    <b>{entry.actor_name}</b> · {new Date(entry.created_at).toLocaleString()}
                    <br />
                    {entry.from_status || '—'} → {entry.to_status}
                    {' · '}{entry.from_value}% → {entry.to_value}%
                    <br />
                    <small style={{ color: '#8f8b95' }}>[{entry.source}] {entry.note || ''}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="module-actions">
              <button className="module-primary" onClick={() => setHistoryGoal(null)}>Close</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

