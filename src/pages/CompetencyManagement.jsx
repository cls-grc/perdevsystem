import React, { useCallback, useEffect, useState } from 'react'
import WorkflowPage from '../components/WorkflowPage'
import { api } from '../lib/api'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Target, BookOpen } from 'lucide-react'

// ---------------------------------------------------------------------------
// Competency Management page — wraps the shared WorkflowPage with a live
// "Skill Gap Learning Progress" panel that cross-links Competency → Learning.
// ---------------------------------------------------------------------------

function SkillGapProgressPanel() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}') } catch { return {} } })()
  const isHr = user.role === 'hr'
  const isSupervisor = user.role === 'supervisor'
  const isEmployee = user.role === 'employee'

  const [open, setOpen] = useState(true)
  const [employees, setEmployees] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [gaps, setGaps] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load employee list (HR/supervisor only)
  useEffect(() => {
    if (isEmployee) return
    api.workflowSubjects().catch(() => ({ employees: [] })).then(res => {
      setEmployees(res.employees || [])
    })
  }, [isEmployee])

  // Load gaps + assignments for selected employee (or self for employee role)
  const loadData = useCallback(async (empId) => {
    const targetId = empId || (isEmployee ? user.employeeId : null)
    if (!targetId) { setGaps([]); setAssignments([]); return }
    setLoading(true)
    setError('')
    try {
      const [gapRes, assignRes] = await Promise.all([
        api.learningSkillGaps({ employeeId: targetId }),
        api.learningAssignments(),
      ])
      setGaps(gapRes.skillGaps || gapRes.gaps || [])
      setAssignments(assignRes.assignments || [])
    } catch (err) {
      setError(err.message || 'Could not load skill gap data.')
    } finally {
      setLoading(false)
    }
  }, [isEmployee, user.employeeId])

  useEffect(() => {
    if (isEmployee) {
      loadData(null)
    } else if (selectedEmpId) {
      loadData(selectedEmpId)
    } else {
      setGaps([])
      setAssignments([])
    }
  }, [selectedEmpId, isEmployee, loadData])

  const getStatusColor = (gap) => {
    if (gap <= 0) return { bg: '#d1fae5', color: '#065f46', label: 'On Track' }
    if (gap <= 10) return { bg: '#fef9c3', color: '#854d0e', label: 'Minor Gap' }
    if (gap <= 20) return { bg: '#fed7aa', color: '#9a3412', label: 'Gap' }
    return { bg: '#fee2e2', color: '#991b1b', label: 'Critical Gap' }
  }

  const getLinkedAssignment = (competency) => {
    return assignments.find(a =>
      (a.competencies || []).some(c => c.toLowerCase() === competency.toLowerCase()) ||
      a.resource_title?.toLowerCase().includes(competency.toLowerCase().split(' ')[0])
    )
  }

  if (!isHr && !isSupervisor && !isEmployee) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.85)', borderRadius: 14,
      border: '1px solid rgba(99,102,241,0.18)', marginBottom: 20,
      boxShadow: '0 2px 12px rgba(99,102,241,0.07)', overflow: 'hidden',
    }}>
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(124,58,237,0.05))',
          border: 'none', borderBottom: open ? '1px solid rgba(99,102,241,0.12)' : 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#3730a3' }}>
          <Target size={16} style={{ color: '#6366f1' }} />
          Skill Gap Learning Progress
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            Live Cross-Module View
          </span>
        </span>
        {open ? <ChevronUp size={16} style={{ color: '#6366f1' }} /> : <ChevronDown size={16} style={{ color: '#6366f1' }} />}
      </button>

      {open && (
        <div style={{ padding: '16px 20px' }}>
          {/* Employee selector (HR/Supervisor) */}
          {!isEmployee && (
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>View Skill Gaps For:</label>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 220 }}
              >
                <option value="">— Select an employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.job_title} · {emp.department})
                  </option>
                ))}
              </select>
              {selectedEmpId && gaps.length > 0 && (
                <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>
                  {gaps.length} gap{gaps.length > 1 ? 's' : ''} detected
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, marginBottom: 10, fontSize: 12, color: '#991b1b' }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
              Analyzing skill gaps and linked courses…
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && gaps.length === 0 && (selectedEmpId || isEmployee) && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px',
              background: 'rgba(240,253,244,0.7)', borderRadius: 10, border: '1px solid #a7f3d0', textAlign: 'center',
            }}>
              <CheckCircle size={24} style={{ color: '#10b981', marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46', margin: '0 0 4px' }}>All Competencies On Track</p>
              <p style={{ fontSize: 12, color: '#047857', margin: 0 }}>No skill gaps detected. Keep developing!</p>
            </div>
          )}

          {/* No employee selected */}
          {!loading && !error && !isEmployee && !selectedEmpId && (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
              Select an employee above to view their competency gaps and linked learning progress.
            </p>
          )}

          {/* Gap table */}
          {!loading && gaps.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(99,102,241,0.15)' }}>
                    {['Competency', 'Current', 'Required', 'Gap', 'Status', 'Linked Course', 'Progress'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g, idx) => {
                    const st = getStatusColor(g.gap)
                    const linked = getLinkedAssignment(g.competency)
                    const progress = linked ? (Number(linked.progress) || 0) : null
                    const verified = linked?.is_completed
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1e293b' }}>{g.competency}</td>
                        <td style={{ padding: '10px 10px', color: '#475569' }}>{g.score}%</td>
                        <td style={{ padding: '10px 10px', color: '#475569' }}>{g.required_score}%</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontWeight: 700, color: g.gap > 0 ? '#dc2626' : '#059669' }}>
                            {g.gap > 0 ? `-${g.gap}%` : '✓'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', maxWidth: 180 }}>
                          {linked ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4338ca', fontWeight: 600 }}>
                              <BookOpen size={11} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linked.resource_title}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Not assigned yet</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', minWidth: 110 }}>
                          {linked && progress !== null ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10, color: '#64748b' }}>
                                <span>{verified ? '✓ Verified' : `${progress}%`}</span>
                                {linked.status && !verified && <span style={{ textTransform: 'capitalize' }}>{linked.status.replace('_', ' ')}</span>}
                              </div>
                              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3 }}>
                                <div style={{
                                  height: '100%', borderRadius: 3, transition: 'width 0.4s ease',
                                  width: `${verified ? 100 : progress}%`,
                                  background: verified ? '#10b981' : progress >= 75 ? '#6366f1' : progress >= 40 ? '#f59e0b' : '#94a3b8',
                                }} />
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          {!loading && gaps.length > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { bg: '#d1fae5', color: '#065f46', label: 'On Track' },
                { bg: '#fef9c3', color: '#854d0e', label: 'Minor Gap (≤10%)' },
                { bg: '#fed7aa', color: '#9a3412', label: 'Gap (11–20%)' },
                { bg: '#fee2e2', color: '#991b1b', label: 'Critical (>20%)' },
              ].map(s => (
                <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <em style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.bg, border: `1px solid ${s.color}` }} />
                  <span style={{ color: '#64748b' }}>{s.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompetencyManagement() {
  return (
    <div>
      <SkillGapProgressPanel />
      <WorkflowPage
        module="competency"
        title="Skill development"
        description="Manage the competency and development-plan actions assigned to your role."
        action={{ hr: 'Create development plan' }}
        stages={[
          ["Define competency requirements", "Define hospitality competency requirements and development objectives.", ["hr"]],
          ["Assign development plan", "Review detected skill gaps, pick recommended learning courses, and assign learning paths.", ["hr", "supervisor"]],
          ["Track learning progress", "Review assigned learning and development progress.", ["employee", "supervisor"]],
          ["Update competency record", "Update competency records and analytics.", ["hr"]],
        ]}
        items={[]}
        itemLabel="Development plan"
        itemIsEmployee
      />
    </div>
  )
}
