import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/exportUtils'

const roleLabels = { employee: 'Employee', supervisor: 'Supervisor', management: 'Management', hr: 'HR', operations_manager: 'Ops Manager' }

const initials = name => (name || '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [usersByEmployee, setUsersByEmployee] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [history, setHistory] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'employee', fullName: '', departmentId: '' })
  const [form, setForm] = useState({
    employeeNumber: '', fullName: '', departmentId: '', jobTitle: '',
    managerId: '', performanceScore: 0, competencyScore: 0, learningProgress: 0,
  })
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [empResult, deptResult] = await Promise.all([
        filter === 'all' ? api.employeesAll() : api.employees(),
        api.departments(),
      ])
      setEmployees(empResult.employees || [])
      setDepartments(deptResult.departments || [])
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [filter])

  const resetForm = () => {
    setForm({ employeeNumber: '', fullName: '', departmentId: departments[0]?.id || '', jobTitle: '', managerId: '', performanceScore: 0, competencyScore: 0, learningProgress: 0 })
    setEditId(null)
  }

  const openEdit = (emp) => {
    setForm({
      employeeNumber: emp.employee_number,
      fullName: emp.full_name,
      departmentId: emp.department_id || departments[0]?.id || '',
      jobTitle: emp.job_title,
      managerId: emp.manager_id || '',
      performanceScore: emp.performance_score,
      competencyScore: emp.competency_score,
      learningProgress: emp.learning_progress,
    })
    setEditId(emp.id)
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setSaving(true)
    try {
      const data = { ...form, managerId: form.managerId || null, departmentId: form.departmentId || departments[0]?.id }
      if (editId) {
        await api.updateEmployee(editId, data)
        setNotice('Employee updated successfully.')
      } else {
        await api.createEmployee(data)
        setNotice('Employee created successfully.')
      }
      setShowForm(false); resetForm(); await load()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleActive = async (emp) => {
    setError(''); setNotice('')
    try {
      if (emp.is_active) {
        await api.deactivateEmployee(emp.id)
        setNotice(`${emp.full_name} has been deactivated.`)
      } else {
        await api.reactivateEmployee(emp.id)
        setNotice(`${emp.full_name} has been reactivated.`)
      }
      await load()
    } catch (e) { setError(e.message) }
  }

  const showHistory = async (emp) => {
    setError('')
    try {
      const result = await api.employeeHistory(emp.id)
      setHistory({ employee: emp.full_name, history: result.history || [] })
    } catch (e) { setError(e.message) }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setSaving(true)
    try {
      const result = await api.invite({ ...inviteForm, departmentId: inviteForm.departmentId || null })
      setNotice(`Invitation created for ${inviteForm.fullName}.`)
      setInviteOpen(false)
      setInviteForm({ email: '', role: 'employee', fullName: '', departmentId: '' })
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const filtered = useMemo(() => employees.filter(e =>
    `${e.full_name} ${e.department_name || e.department} ${e.job_title} ${e.employee_number}`
      .toLowerCase().includes(query.toLowerCase())
  ), [employees, query])

  const activeCount = employees.filter(e => e.is_active).length
  const deptCount = new Set(employees.map(e => e.department_name || e.department).filter(Boolean)).size

  const exportCsv = async () => {
    try {
      const rows = await api.exportEmployeesCsv()
      const formatted = rows.map(e => ({
        'Employee Number': e.employee_number,
        'Full Name': e.full_name,
        'Department': e.department_name || e.department || '',
        'Job Title': e.job_title || '',
        'Performance Score': e.performance_score || 0,
        'Competency Score': e.competency_score || 0,
        'Learning Progress': e.learning_progress || 0,
        'Status': e.is_active ? 'Active' : 'Inactive',
      }))
      downloadCsv(formatted, `employees-${new Date().toISOString().slice(0,10)}.csv`)
    } catch (e) { setError(e.message) }
  }

  return (
    <main className="er-workspace">
      <div className="er-heading">
        <div>
          <p className="eyebrow">HR Administration</p>
          <h1>Employee Records</h1>
          <p>Manage the employee lifecycle, organizational assignments, and system access.</p>
        </div>
        <div className="er-heading-actions">
          <button className="module-secondary" onClick={exportCsv} title="Export all employee records to CSV">⬇ Export CSV</button>
          <button className="module-secondary" onClick={() => setInviteOpen(true)}>Send invite</button>
          <button className="module-primary" onClick={() => { resetForm(); setShowForm(true) }}>+ Add employee</button>
        </div>
      </div>

      {notice && <p className="module-notice">✓ {notice}</p>}
      {error && <p className="module-error">{error}</p>}

      <section className="er-kpis">
        <article><small>Total employees</small><b>{employees.length}</b><em>{filter === 'all' ? 'Including inactive' : 'Active records'}</em></article>
        <article><small>Active accounts</small><b>{activeCount}</b><em>{Math.round((activeCount / Math.max(employees.length, 1)) * 100)}% of records</em></article>
        <article><small>Departments</small><b>{deptCount}</b><em>Across the organization</em></article>
        <article><small>Workforce health</small><b>{employees.length ? Math.round(employees.reduce((s, e) => s + (Number(e.performance_score) || 0), 0) / employees.length) : 0}%</b><em>Avg performance score</em></article>
      </section>

      <section className="er-panel">
        <div className="er-panel-head">
          <div>
            <h2>Employee directory</h2>
            <p>Search and manage all employee records.</p>
          </div>
          <div className="er-filters">
            <div className="er-tabs">
              <button className={`er-tab ${filter === 'active' ? 'er-tab-active' : ''}`} onClick={() => setFilter('active')}>Active</button>
              <button className={`er-tab ${filter === 'all' ? 'er-tab-active' : ''}`} onClick={() => setFilter('all')}>All</button>
            </div>
            <div className="employee-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, department, job title..." />
            </div>
          </div>
        </div>

        <div className="er-table-wrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Performance</th>
                <th>Competency</th>
                <th>Learning</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="er-employee">
                      <span className="er-avatar">{initials(emp.full_name)}</span>
                      <div>
                        <b>{emp.full_name}</b>
                        <small>{emp.employee_number}</small>
                      </div>
                    </div>
                  </td>
                  <td>{emp.department_name || emp.department || '—'}</td>
                  <td>{emp.job_title}</td>
                  <td><span className="er-score">{emp.performance_score || 0}%</span></td>
                  <td><span className="er-score">{emp.competency_score || 0}%</span></td>
                  <td><span className="er-score">{emp.learning_progress || 0}%</span></td>
                  <td><span className={`er-status ${emp.is_active ? 'active' : 'inactive'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="er-row-actions">
                      <button title="Edit" onClick={() => openEdit(emp)}>Edit</button>
                      <button title="Score history" onClick={() => showHistory(emp)}>History</button>
                      <button className={emp.is_active ? 'danger' : 'ok'} title={emp.is_active ? 'Deactivate' : 'Reactivate'} onClick={() => toggleActive(emp)}>
                        {emp.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={8} className="er-empty">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="settings-backdrop" onClick={() => setShowForm(false)}>
          <section className="settings-dialog er-dialog" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit employee' : 'Add employee'}</h2>
            <p className="er-dialog-sub">{editId ? 'Update the employee record below.' : 'Create a new employee record.'}</p>
            <form onSubmit={save}>
              <div className="er-form-grid">
                <label>Employee number<input value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} required disabled={!!editId} /></label>
                <label>Full name<input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required /></label>
                <label>Department<select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
                <label>Job title<input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} required /></label>
                <label className="er-full">Manager<select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}>
                  <option value="">— No manager —</option>
                  {employees.filter(e => e.is_active && e.id !== editId).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select></label>
                <label>Performance %<input type="number" min={0} max={100} value={form.performanceScore} onChange={e => setForm({ ...form, performanceScore: Number(e.target.value) })} /></label>
                <label>Competency %<input type="number" min={0} max={100} value={form.competencyScore} onChange={e => setForm({ ...form, competencyScore: Number(e.target.value) })} /></label>
                <label className="er-full">Learning %<input type="number" min={0} max={100} value={form.learningProgress} onChange={e => setForm({ ...form, learningProgress: Number(e.target.value) })} /></label>
              </div>
              <div className="module-actions">
                <button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="module-primary" disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update employee' : 'Create employee')}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Score history modal */}
      {history && (
        <div className="settings-backdrop" onClick={() => setHistory(null)}>
          <section className="settings-dialog er-dialog" onClick={e => e.stopPropagation()}>
            <h2>Score history — {history.employee}</h2>
            <p className="er-dialog-sub">Snapshot of scores recorded over time.</p>
            {history.history.length ? (
              <div className="er-table-wrap">
                <table className="er-table">
                  <thead><tr><th>Date</th><th>Performance</th><th>Competency</th><th>Learning</th></tr></thead>
                  <tbody>
                    {history.history.map(row => (
                      <tr key={row.id}>
                        <td>{new Date(row.recorded_at).toLocaleDateString()}</td>
                        <td><span className="er-score">{row.performance_score}%</span></td>
                        <td><span className="er-score">{row.competency_score}%</span></td>
                        <td><span className="er-score">{row.learning_progress}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="er-empty">No score history available.</p>}
            <div className="module-actions"><button className="cancel-button" onClick={() => setHistory(null)}>Close</button></div>
          </section>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="settings-backdrop" onClick={() => setInviteOpen(false)}>
          <section className="settings-dialog er-dialog" onClick={e => e.stopPropagation()}>
            <h2>Send invitation</h2>
            <p className="er-dialog-sub">The user receives a registration link valid for 7 days.</p>
            <form onSubmit={sendInvite}>
              <div className="er-form-grid">
                <label>Full name<input value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })} required /></label>
                <label>Email<input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required /></label>
                <label>Role<select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>Department<select value={inviteForm.departmentId} onChange={e => setInviteForm({ ...inviteForm, departmentId: e.target.value })}>
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
              </div>
              <div className="module-actions">
                <button type="button" className="cancel-button" onClick={() => setInviteOpen(false)}>Cancel</button>
                <button className="module-primary" disabled={saving}>{saving ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
