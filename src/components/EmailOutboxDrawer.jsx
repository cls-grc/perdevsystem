import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function EmailOutboxDrawer({ isOpen, onClose }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.emailOutbox()
      setEmails(result.emails || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) { load() }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="outbox-drawer-wrapper">
      {/* Backdrop */}
      <div className="outbox-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="outbox-drawer-box">
        {/* Header */}
        <div className="outbox-head">
          <div>
            <div className="outbox-title-row">
              <span className="outbox-icon">📧</span>
              <h2>Live Email Outbox</h2>
              <span className="outbox-role-badge">HR / Management</span>
            </div>
            <p className="outbox-sub">
              Real-time log of all emails dispatched by the system.
            </p>
          </div>
          <div className="outbox-actions">
            <button onClick={load} className="outbox-refresh-btn">
              ↻ Refresh
            </button>
            <button onClick={onClose} className="outbox-close-btn">
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="outbox-body">
          {error && (
            <div className="outbox-err-banner">
              {error}
            </div>
          )}
          {loading ? (
            <div className="outbox-loading">Loading outbox…</div>
          ) : emails.length === 0 ? (
            <div className="outbox-empty">
              <div className="outbox-empty-icon">📭</div>
              <b>No emails dispatched yet</b>
              <p>
                Emails are recorded here when the system sends invitations, password resets, or training notifications.
              </p>
            </div>
          ) : (
            <div className="outbox-card-list">
              {emails.map((email) => (
                <article key={email.id} className="outbox-card">
                  {/* Email header row */}
                  <button
                    onClick={() => setExpanded(expanded === email.id ? null : email.id)}
                    className="outbox-card-btn"
                  >
                    <span className="outbox-mail-circle">✉</span>
                    <div className="outbox-mail-meta">
                      <b>{email.subject}</b>
                      <small>
                        To: {email.to} · {new Date(email.sentAt).toLocaleString()}
                      </small>
                    </div>
                    <span className={`outbox-status-pill ${email.status === 'sent' ? 'sent' : 'demo'}`}>
                      {email.status === 'sent' ? '✓ Sent' : '⚡ Demo'}
                    </span>
                  </button>

                  {/* Expanded body */}
                  {expanded === email.id && (
                    <div className="outbox-card-details">
                      <pre className="outbox-code-block">
                        {email.text || '(No body content)'}
                      </pre>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="outbox-foot">
          <p>
            {emails.length} email{emails.length !== 1 ? 's' : ''} recorded since server start · In-memory queue, last 50 shown
          </p>
        </div>
      </div>
    </div>
  )
}
