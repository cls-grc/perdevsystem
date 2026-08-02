import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const getRole = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return undefined }
}
const getEmployeeId = () => {
  try { return JSON.parse(localStorage.getItem('pds-user') || '{}').employeeId } catch { return undefined }
}

const relationshipPill = {
  peer: 'gf-pill-peer',
  supervisor: 'gf-pill-supervisor',
  subordinate: 'gf-pill-subordinate',
  self: 'gf-pill-self',
}

const initials = name => name?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || ''

const Stars = ({ value }) => (
  <span className="gf-rating">
    {[1, 2, 3, 4, 5].map(n => (
      <span key={n} className={n <= Math.round(value || 0) ? 'star-on' : 'star-off'}>★</span>
    ))}
  </span>
)

export default function Feedback360() {
  const role = getRole()
  const myEmployeeId = getEmployeeId()
  const [requests, setRequests] = useState([])
  const [pending, setPending] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('requests')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [submitForm, setSubmitForm] = useState(null)
  const [requestForm, setRequestForm] = useState({ subjectEmployeeId: '', relationship: 'peer', message: '', authorEmployeeId: '' })
  const [submission, setSubmission] = useState({ strengths: '', improvements: '', overallRating: 3 })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [reqResult, empResult, pendResult] = await Promise.all([
        api.feedbackRequests(),
        api.employees().catch(() => ({ employees: [] })),
        api.pendingFeedback().catch(() => ({ pendingRequests: [] })),
      ])
      setRequests(reqResult.feedbackRequests || [])
      setEmployees(empResult.employees || [])
      setPending(pendResult.pendingRequests || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSendRequest = async () => {
    setError('')
    setNotice('')
    try {
      await api.createFeedbackRequest(requestForm)
      setNotice('Feedback request sent.')
      setShowRequestForm(false)
      setRequestForm({ subjectEmployeeId: '', relationship: 'peer', message: '', authorEmployeeId: '' })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmit = async () => {
    if (!submitForm) return
    setError('')
    setNotice('')
    try {
      await api.submitFeedback(submitForm.id, submission)
      setNotice('Feedback submitted. Thank you!')
      setSubmitForm(null)
      setSubmission({ strengths: '', improvements: '', overallRating: 3 })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleClose = async (id) => {
    try {
      await api.closeFeedback(id)
      setNotice('Request closed.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const canClose = (req) => role === 'hr' // || req.requested_by === currentUserId

  if (loading) return <main className="module-workspace"><div className="dashboard-skeleton"><i /><i /><i /><i /></div></main>

  const totalRequests = requests.length
  const submittedCount = requests.filter(r => r.status === 'submitted').length
  const closedCount = requests.filter(r => r.status === 'closed').length
  const pendingCount = pending.length
  const displayList = tab === 'pending' ? pending : requests

  return (
    <main className="module-workspace">
      <div className="module-heading">
        <div>
          <h1>360° Feedback</h1>
          <p>Request and submit peer, supervisor, and subordinate feedback.</p>
        </div>
        <div className="module-heading-actions">
          <button className="module-primary" onClick={() => setShowRequestForm(true)}>New request</button>
        </div>
      </div>

      {notice && <div className="module-notice">✓ {notice}</div>}
      {error && <div className="module-error" role="alert">{error}</div>}
      {pendingCount > 0 && (
        <div className="module-notice" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
          ⚠ You have {pendingCount} pending feedback request(s) to respond to.
        </div>
      )}

      <section className="gf-kpis">
        <article><small>Total requests</small><b>{totalRequests}</b><em className="gf-kpi-accent">All records</em></article>
        <article><small>Pending for me</small><b>{pendingCount}</b><em>Awaiting response</em></article>
        <article><small>Submitted</small><b>{submittedCount}</b><em>✓ Feedback given</em></article>
        <article><small>Closed</small><b>{closedCount}</b><em>Completed cycles</em></article>
      </section>

      <div className="gf-tabs">
        <button className={`gf-tab ${tab === 'requests' ? 'gf-tab-active' : ''}`} onClick={() => setTab('requests')}>All requests</button>
        <button className={`gf-tab ${tab === 'pending' ? 'gf-tab-active' : ''}`} onClick={() => setTab('pending')}>Pending for me ({pendingCount})</button>
      </div>

      <section className="gf-list">
        {displayList.length === 0 ? (
          <div className="gf-empty">
            <b>{tab === 'pending' ? 'No pending feedback requests' : 'No feedback requests yet'}</b>
            <p>{tab === 'pending' ? 'You have no outstanding feedback to submit.' : 'Create a request to gather 360° feedback about an employee.'}</p>
          </div>
        ) : displayList.map(req => (
          <article key={req.id} className="gf-card">
            <div className="gf-card-head">
              <div>
                <h3 className="gf-card-title">Feedback for {req.subject_name}</h3>
                <small className="gf-card-sub">
                  Requested by {req.requester_name}
                  {req.created_at && ` · ${new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </small>
              </div>
              <span className={`gf-pill ${relationshipPill[req.relationship] || 'gf-pill-peer'}`}>{req.relationship}</span>
            </div>

            <div className="gf-card-owner">
              <span className="er-avatar">{initials(req.subject_name)}</span>
              <span>{req.subject_name} · {req.subject_department || 'Employee'}</span>
            </div>

            {req.message && <p className="gf-objective">“{req.message}”</p>}

            {(req.strengths || req.improvements || req.overall_rating) && (
              <div className="gf-fb-rows">
                {req.strengths && <div className="gf-fb-row"><b>Strengths:</b> {req.strengths}</div>}
                {req.improvements && <div className="gf-fb-row"><b>Growth areas:</b> {req.improvements}</div>}
                {req.overall_rating && (
                  <div className="gf-fb-row"><b>Overall rating:</b> <Stars value={req.overall_rating} /></div>
                )}
              </div>
            )}

            <div className="gf-card-foot">
              <span className={`gf-status ${req.status}`}>{req.status}</span>
              <div className="gf-card-owner" style={{ marginRight: 'auto' }}>
                <span className="er-avatar">{initials(req.requester_name)}</span>
                <span>by {req.requester_name}</span>
              </div>
              {req.status === 'pending' && req.author_employee_id === myEmployeeId && (
                <button className="module-primary" onClick={() => setSubmitForm(req)}>Submit feedback</button>
              )}
              {(canClose(req) || req.requested_by === req.requester_name) && req.status !== 'closed' && (
                <button className="module-secondary" onClick={() => handleClose(req.id)}>Close</button>
              )}
            </div>
          </article>
        ))}
      </section>

      {showRequestForm && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setShowRequestForm(false)}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h2 className="gf-dialog-title">New feedback request</h2>
            <p className="gf-dialog-sub">Ask someone to provide feedback about an employee.</p>
            <label>Subject (who is being reviewed?)
              <select value={requestForm.subjectEmployeeId} onChange={e => setRequestForm({ ...requestForm, subjectEmployeeId: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </label>
            <label>Reviewer (who will give feedback?)
              <select value={requestForm.authorEmployeeId} onChange={e => setRequestForm({ ...requestForm, authorEmployeeId: e.target.value })}>
                <option value="">Select reviewer</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </label>
            <label>Relationship
              <select value={requestForm.relationship} onChange={e => setRequestForm({ ...requestForm, relationship: e.target.value })}>
                <option value="peer">Peer</option>
                <option value="supervisor">Supervisor</option>
                <option value="subordinate">Subordinate</option>
                <option value="self">Self-reflection</option>
              </select>
            </label>
            <label>Message (optional)<textarea value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })} placeholder="What should the reviewer focus on?" /></label>
            <div className="module-actions">
              <button className="cancel-button" onClick={() => setShowRequestForm(false)}>Cancel</button>
              <button className="module-primary" onClick={handleSendRequest} disabled={!requestForm.subjectEmployeeId || !requestForm.authorEmployeeId}>Send request</button>
            </div>
          </section>
        </div>
      )}

      {submitForm && (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setSubmitForm(null)}>
          <section className="settings-dialog gf-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h2 className="gf-dialog-title">Submit feedback</h2>
            <p className="gf-dialog-sub">For: <strong>{submitForm.subject_name}</strong></p>
            <label>Strengths<textarea value={submission.strengths} onChange={e => setSubmission({ ...submission, strengths: e.target.value })} placeholder="What does this person do well?" /></label>
            <label>Growth areas<textarea value={submission.improvements} onChange={e => setSubmission({ ...submission, improvements: e.target.value })} placeholder="What could they improve?" /></label>
            <label>Overall rating (1-5)
              <div className="gf-rating-pick">
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className={n <= submission.overallRating ? 'star-on' : 'star-off'} onClick={() => setSubmission({ ...submission, overallRating: n })}>★</span>
                ))}
              </div>
            </label>
            <div className="module-actions">
              <button className="cancel-button" onClick={() => setSubmitForm(null)}>Cancel</button>
              <button className="module-primary" onClick={handleSubmit}>Submit feedback</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

