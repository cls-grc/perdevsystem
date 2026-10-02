import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import ModuleAIInsights from '../components/ModuleAIInsights'
import CourseContentViewer from '../components/CourseContentViewer'
import {
  CheckCircle, Target, Play, FileText, BookOpen, X, Sparkles,
  Compass, AlertTriangle, ArrowRight, Award, Zap, ChevronRight,
  ClipboardList, BarChart2, Lock, Unlock, RotateCcw, Info, ShieldCheck,
} from 'lucide-react'
import '../learningLibrary.css'

const CATEGORIES = ['Leadership', 'Customer Service', 'Food Safety', 'Kitchen Operations', 'Compliance', 'Communication', 'Sales', 'Technical Skills']
const PROV_TYPES = ['internal', 'external']

// Evidence-based statuses (computed by server — read-only)
const STATUS_LABELS = {
  not_started:         'Not Started',
  in_progress:         'In Progress',
  assessment_pending:  'Assessment Pending',
  completed:           'Completed',
  needs_improvement:   'Needs Improvement',
}

const STATUS_PILL = {
  not_started:        'status not-started',
  in_progress:        'status studying',
  assessment_pending: 'status studying',
  completed:          'status completed',
  needs_improvement:  'status need-help',
}

const STATUS_COLOR = {
  not_started:        '#64748b',
  in_progress:        '#3b82f6',
  assessment_pending: '#f59e0b',
  completed:          '#10b981',
  needs_improvement:  '#ef4444',
}

function initials(name = '') {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
}

// ── Assessment Modal ─────────────────────────────────────────────────────────
function AssessmentModal({ assignment, onClose, onComplete }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getLearningAssessment(assignment.id)
        setData(res)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [assignment.id])

  const allAnswered = data && Object.keys(answers).length === data.questions.length

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSubmitting(true)
    setError('')
    try {
      const formattedAnswers = data.questions.map((q, idx) => ({
        questionId: q.id || `q${idx + 1}`,
        selectedIndex: answers[idx],
      }))
      const res = await api.submitLearningAssessment(assignment.id, formattedAnswers)
      setResult(res)
      setSubmitted(true)
      onComplete && onComplete(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="learning-modal-backdrop" role="dialog" aria-modal="true" aria-label="Course Assessment" onClick={onClose}>
      <div className="learning-modal-dialog" style={{ maxWidth: 640, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="learning-modal-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} /> Course Assessment
            </h2>
            <p>{assignment.resource_title}</p>
          </div>
          <button type="button" className="learning-modal-close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="learning-modal-body">
          {loading && <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading assessment questions…</div>}
          {error && <div className="module-error" role="alert"><span>{error}</span></div>}
          {data && !submitted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', fontSize: 11.5, color: '#1e40af' }}>
                <b>Auto-scored assessment</b> — Pass score: <b>{data.passThreshold}%</b> · {data.totalQuestions} questions · Attempt {data.attemptsCount + 1}
              </div>
              {data.questions.map((q, idx) => (
                <div key={q.id || idx} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 10px', color: '#111827', lineHeight: 1.4 }}>
                    <span style={{ color: '#6366f1', marginRight: 6 }}>Q{idx + 1}.</span>{q.question}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt, optIdx) => (
                      <label
                        key={optIdx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          borderRadius: 7, border: `1.5px solid ${answers[idx] === optIdx ? '#6366f1' : '#e5e7eb'}`,
                          background: answers[idx] === optIdx ? 'rgba(99,102,241,0.06)' : '#f9fafb',
                          cursor: 'pointer', fontSize: 12, color: '#374151', lineHeight: 1.4,
                        }}
                      >
                        <input
                          type="radio"
                          name={`q${idx}`}
                          checked={answers[idx] === optIdx}
                          onChange={() => setAnswers(prev => ({ ...prev, [idx]: optIdx }))}
                          style={{ flexShrink: 0 }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {submitted && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Result banner */}
              <div style={{
                padding: '18px 20px', borderRadius: 12, textAlign: 'center',
                background: result.passed ? 'linear-gradient(135deg, #d1fae5, #ecfdf5)' : 'linear-gradient(135deg, #fee2e2, #fff5f5)',
                border: `1.5px solid ${result.passed ? '#a7f3d0' : '#fca5a5'}`,
              }}>
                {result.passed
                  ? <CheckCircle size={32} style={{ color: '#10b981', marginBottom: 8 }} />
                  : <AlertTriangle size={32} style={{ color: '#ef4444', marginBottom: 8 }} />}
                <div style={{ fontSize: 18, fontWeight: 800, color: result.passed ? '#065f46' : '#991b1b' }}>
                  {result.passed ? 'Assessment Passed!' : 'Assessment Not Passed'}
                </div>
                <div style={{ fontSize: 13, color: result.passed ? '#047857' : '#b91c1c', marginTop: 4 }}>
                  Score: <b>{result.score}%</b> · Pass threshold: <b>{result.passThreshold}%</b> · {result.correct}/{result.totalQuestions} correct
                </div>
                {!result.passed && (
                  <div style={{ fontSize: 11, marginTop: 8, color: '#7f1d1d' }}>
                    Review the material and try again. Your progress has been saved (Attempt #{result.attemptNumber}).
                  </div>
                )}
              </div>

              {/* Question review */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {result.scoredAnswers.map((ans, idx) => {
                  const q = data.questions[idx]
                  return (
                    <div key={idx} style={{
                      padding: '12px 14px', borderRadius: 8,
                      background: ans.isCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                      border: `1px solid ${ans.isCorrect ? '#d1fae5' : '#fee2e2'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {ans.isCorrect
                          ? <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                          : <X size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Q{idx + 1}. {q?.question}</div>
                          <div style={{ fontSize: 11, color: ans.isCorrect ? '#047857' : '#991b1b', marginTop: 3 }}>
                            Your answer: <b>{q?.options?.[ans.selectedIndex] || 'None'}</b>
                          </div>
                          {!ans.isCorrect && q?.options?.[ans.correctIndex] && (
                            <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                              Correct: <b>{q.options[ans.correctIndex]}</b>
                            </div>
                          )}
                          {ans.explanation && (
                            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                              {ans.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="learning-modal-footer">
          {!submitted && (
            <>
              <button type="button" className="module-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="module-primary"
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Scoring…' : `Submit Assessment (${Object.keys(answers).length}/${data?.questions?.length || '?'} answered)`}
              </button>
            </>
          )}
          {submitted && (
            <button type="button" className="module-primary" onClick={onClose}>
              {result?.passed ? 'Close — Course Completed!' : 'Close & Review Material'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── HR Override Modal ────────────────────────────────────────────────────────
function OverrideModal({ assignment, onClose, onDone }) {
  const [overrideStatus, setOverrideStatus] = useState(assignment.status || 'completed')
  const [overrideProgress, setOverrideProgress] = useState(Number(assignment.progress) || 100)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      return setError('Please provide a reason for this override (minimum 5 characters).')
    }
    setSubmitting(true)
    setError('')
    try {
      await api.overrideLearningAssignment(assignment.id, {
        status: overrideStatus,
        progress: overrideProgress,
        reason: reason.trim(),
      })
      onDone && onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="learning-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="learning-modal-dialog" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="learning-modal-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} style={{ color: '#f59e0b' }} /> HR Authorized Override
            </h2>
            <p>{assignment.resource_title} — {assignment.employee_name}</p>
          </div>
          <button type="button" className="learning-modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="learning-modal-body">
          <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11.5, color: '#92400e', marginBottom: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <b>Authorized Override</b>
            </span>
            {' '}— This action bypasses the evidence-based system. It will be recorded in the Audit Log with your name and reason.
          </div>
          {error && <div className="module-error" role="alert" style={{ marginBottom: 10 }}><span>{error}</span></div>}
          <div className="learning-fields" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Override status
              <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="assessment_pending">Assessment Pending</option>
                <option value="completed">Completed</option>
                <option value="needs_improvement">Needs Improvement</option>
              </select>
            </label>
            <label>
              Override completion percentage: <b>{overrideProgress}%</b>
              <input type="range" min="0" max="100" value={overrideProgress}
                onChange={e => setOverrideProgress(Number(e.target.value))} />
            </label>
            <label className="full">
              Reason for override <span style={{ color: '#ef4444' }}>*</span>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Employee completed equivalent external training, documentation provided and verified."
                rows={3}
                required
              />
            </label>
          </div>
        </div>
        <div className="learning-modal-footer">
          <button type="button" className="module-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="module-primary" onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? 'Applying Override…' : 'Apply Override (Audited)'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Progress Breakdown Tooltip ────────────────────────────────────────────────
function ProgressBreakdown({ breakdown }) {
  if (!breakdown) return null
  const b = typeof breakdown === 'string' ? JSON.parse(breakdown) : breakdown
  return (
    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <BookOpen size={12} style={{ color: '#64748b', flexShrink: 0 }} />
        <span>Material: <b>{b.materialProgress || 0}/50 pts</b></span>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ClipboardList size={12} style={{ color: '#64748b', flexShrink: 0 }} />
        <span>Assessment: <b>{b.assessmentProgress || 0}/50 pts</b>
          {b.assessmentScore != null && <> (score: <b>{b.assessmentScore}%</b>, threshold: <b>{b.passThreshold || 75}%</b>)</>}
        </span>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <RotateCcw size={11} style={{ color: '#64748b', flexShrink: 0 }} />
        <span>Attempts: <b>{b.attempts || 0}</b></span>
      </div>
      <div style={{ marginTop: 2, fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>{b.calculationBasis || ''}</div>
      {b.overrideNote && (
        <div style={{ marginTop: 4, color: '#f59e0b', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ShieldCheck size={12} style={{ flexShrink: 0 }} />
          <span>{b.overrideNote}</span>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LearningManagement() {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const hr = role === 'hr'
  const supervisor = role === 'supervisor'
  const canManage = hr || role === 'operations_manager'
  const canAssign = hr || role === 'operations_manager' || supervisor || role === 'management'
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
  const [form, setForm] = useState({
    title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal',
    durationHours: '', objectives: '', url: '', videoUrl: '', pdfUrl: '', lessonContent: '',
    competencies: [], passThreshold: 75,
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Course content viewer
  const [viewResource, setViewResource] = useState(null)
  const [viewResourceAssignment, setViewResourceAssignment] = useState(null)

  // Assign flow
  const [assignResource, setAssignResource] = useState(null)
  const [assignIds, setAssignIds] = useState([])
  const [dueDate, setDueDate] = useState('')
  const [empQuery, setEmpQuery] = useState('')

  // Assessment flow
  const [assessmentTarget, setAssessmentTarget] = useState(null)

  // HR Override flow
  const [overrideTarget, setOverrideTarget] = useState(null)

  // HR legacy completion (external courses without quiz)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [assessmentNote, setAssessmentNote] = useState('')

  // Recommendations & AI plan
  const [recommendationsData, setRecommendationsData] = useState(null)
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [aiPlan, setAiPlan] = useState(null)
  const [aiGeneratingPlan, setAiGeneratingPlan] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)

  // HR Monitoring: attempts panel
  const [monitoringTarget, setMonitoringTarget] = useState(null)
  const [monitoringData, setMonitoringData] = useState(null)

  const load = useCallback(async () => {
    try {
      const calls = []
      if (!employee) {
        calls.push(
          api.learningResources(showArchived ? { includeArchived: true } : {}),
          api.learningAssignments(),
          api.workflowSubjects(),
        )
      } else {
        calls.push(
          api.learningResources(),
          api.learningAssignments(),
          api.learningCompletions(),
          api.learningRecommendations().catch(() => null),
        )
      }
      calls.push(api.learningCompetencies())
      const results = await Promise.all(calls)
      setResources(results[0].resources || [])
      setAssignments(results[1].assignments || [])
      if (employee) {
        setCompletions(results[2].completions || [])
        setRecommendationsData(results[3] || null)
      } else {
        setEmployees(results[2].employees || [])
        const comps = await api.learningCompletions().catch(() => ({ completions: [] }))
        setCompletions(comps.completions || [])
      }
      setCompetencies(results[results.length - 1].competencies || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [employee, showArchived])

  useEffect(() => { load() }, [load])

  const loadRecommendations = async (empId) => {
    try {
      const res = await api.learningRecommendations(empId ? { employeeId: empId } : {})
      setRecommendationsData(res)
    } catch (e) {
      console.warn('Could not load recommendations:', e.message)
    }
  }

  useEffect(() => {
    if (tab === 'recommendations') loadRecommendations(selectedEmpId)
  }, [tab, selectedEmpId])

  const triggerGeneratePlan = async (empId) => {
    const targetId = empId || selectedEmpId || recommendationsData?.employee?.id
    if (!targetId) return setError('Please select an employee to generate an AI development plan.')
    setAiGeneratingPlan(true)
    setError('')
    try {
      const result = await api.generateDevelopmentPlan({ employeeId: targetId })
      setAiPlan(result.plan)
      setPlanModalOpen(true)
    } catch (err) {
      setError(err.message || 'Failed to generate AI development plan.')
    } finally {
      setAiGeneratingPlan(false)
    }
  }

  const filtered = useMemo(() => {
    let list = resources
    if (employee) {
      const recIds = new Set((recommendationsData?.recommendedResources || []).map(r => r.id))
      const assignedIds = new Set(assignments.map(a => a.resource_id))
      list = resources.filter(r => {
        if (recIds.has(r.id) || assignedIds.has(r.id)) return true
        if (!recIds.size && !assignedIds.size) {
          const userDept = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').department || '' } catch { return '' } })()
          if (!userDept) return true
          const text = `${r.title} ${r.description} ${r.category} ${(r.competencies || []).join(' ')}`.toLowerCase()
          const dept = userDept.toLowerCase()
          if (dept.includes('front')) return !text.includes('kitchen') && !text.includes('culinary') && !text.includes('cook')
          if (dept.includes('kitchen')) return !text.includes('front desk') && !text.includes('concierge')
          if (dept.includes('housekeeping')) return !text.includes('sous chef') && !text.includes('culinary')
          return true
        }
        return false
      })
    }
    return list.filter(r => {
      const text = `${r.title} ${r.description} ${r.provider || ''} ${r.category || ''} ${(r.competencies || []).join(' ')}`.toLowerCase()
      const matchQ = !query || text.includes(query.toLowerCase())
      const matchC = !category || r.category === category
      const matchP = !provType || r.provider_type === provType
      const matchComp = !compFilter || (r.competencies || []).includes(compFilter)
      return matchQ && matchC && matchP && matchComp
    })
  }, [resources, employee, recommendationsData, assignments, query, category, provType, compFilter])

  const moduleStats = useMemo(() => [
    ['Courses in library', employee ? filtered.length : resources.filter(r => r.is_active !== false).length],
    ['Assigned', assignments.length],
    ['Confirmed completions', completions.length],
    ['Assessment pending', assignments.filter(a => a.status === 'assessment_pending').length],
  ], [resources, assignments, completions, employee, filtered])

  const filteredEmployees = useMemo(() =>
    employees.filter(p => `${p.full_name} ${p.department} ${p.job_title}`.toLowerCase().includes(empQuery.toLowerCase())),
    [employees, empQuery],
  )

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
      url: resource.url || '', videoUrl: resource.video_url || '', pdfUrl: resource.pdf_url || '',
      lessonContent: resource.lesson_content || '', competencies: resource.competencies || [],
      passThreshold: Number(resource.pass_threshold) || 75,
    })
    setEditing(resource); setShowForm(true)
  }

  const archive = async resource => {
    if (!window.confirm(`Archive "${resource.title}"? It will be hidden from the library.`)) return
    try {
      await api.archiveLearningResource(resource.id)
      setResources(items => items.filter(i => i.id !== resource.id))
      setNotice('Course archived.')
    } catch (requestError) { setError(requestError.message) }
  }

  const assign = async () => {
    if (!assignResource || !assignIds.length) return setError('Select a course and at least one employee.')
    try {
      await api.assignLearning({ resourceId: assignResource.id, employeeIds: assignIds, dueDate: dueDate || null })
      setNotice(`Assigned "${assignResource.title}" to ${assignIds.length} employee(s). Evidence-based tracking begins when they access the material.`)
      setAssignResource(null); setAssignIds([]); setDueDate('')
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (requestError) { setError(requestError.message) }
  }

  // Open course content viewer + track access
  const openCourseContent = async (resource, assignment) => {
    setViewResource(resource)
    setViewResourceAssignment(assignment || null)
    // Track access for the employee's own assignment
    if (assignment && (employee || (!employee && assignment.employee_id))) {
      try {
        await api.trackLearningAccess(assignment.id)
        // Refresh assignments to reflect in_progress status
        const comps = await api.learningAssignments()
        setAssignments(comps.assignments || [])
      } catch {
        // Non-critical — content still opens
      }
    }
  }

  // Employee signals they've finished material → transition to assessment_pending
  const handleMaterialComplete = async (assignment) => {
    try {
      await api.completeLearningMaterial(assignment.id)
      setViewResource(null)
      setViewResourceAssignment(null)
      setNotice(`Material marked complete! You can now take the assessment for "${assignment.resource_title}".`)
      const comps = await api.learningAssignments()
      setAssignments(comps.assignments || [])
    } catch (e) {
      setError(e.message)
    }
  }

  // HR legacy completion (external course no quiz)
  const recordCompletion = async () => {
    if (!completeTarget) return
    try {
      await api.recordLearningCompletion({
        resourceId: completeTarget.resource_id,
        employeeId: completeTarget.employee_id,
        assessment: { result: 'HR Verified', note: assessmentNote, recordedAt: new Date().toISOString() },
      })
      setNotice(`Completion verified for "${completeTarget.resource_title}".`)
      setCompleteTarget(null); setAssessmentNote('')
      const [assignResult, compResult] = await Promise.all([api.learningAssignments(), api.learningCompletions()])
      setAssignments(assignResult.assignments || [])
      setCompletions(compResult.completions || [])
    } catch (requestError) { setError(requestError.message) }
  }

  const handleOverrideDone = async () => {
    setOverrideTarget(null)
    setNotice('Override applied and recorded in the audit log.')
    await load()
  }

  const openMonitoring = async (assignment) => {
    setMonitoringTarget(assignment)
    try {
      const res = await api.getLearningAttempts(assignment.id)
      setMonitoringData(res)
    } catch {
      setMonitoringData({ attempts: [] })
    }
  }

  const resourcesForAssign = resources.filter(r => r.is_active !== false)

  return <main className="module-workspace learning-workspace">
    <div className="module-heading">
      <div>
        <h1>Course Library</h1>
        <p>Evidence-based learning: progress is automatically calculated from material access and assessment scores.</p>
      </div>
      {canManage && <div className="module-heading-actions">
        <button className="module-primary" type="button" onClick={() => {
          setForm({ title: '', description: '', category: CATEGORIES[0], provider: '', providerType: 'internal', durationHours: '', objectives: '', url: '', videoUrl: '', pdfUrl: '', lessonContent: '', competencies: [], passThreshold: 75 })
          setEditing(null); setShowForm(true)
        }}>Add course</button>
      </div>}
    </div>

    {notice && <div className="module-notice"><span><CheckCircle className="inline w-4 h-4 mr-1 text-emerald-500" /> {notice}</span><button type="button" className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    <section className="module-metrics">
      {moduleStats.map(([label, value], index) => <article key={label}><span>{index + 1}</span><div><small>{label}</small><b>{value}</b><em>Live database value</em></div></article>)}
    </section>

    {/* Evidence-based system info banner */}
    <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.03))', borderRadius: 10, border: '1px solid rgba(99,102,241,0.18)', marginBottom: 14, fontSize: 11, color: '#3730a3', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Lock size={14} style={{ flexShrink: 0 }} />
      <span><b>Evidence-Based Learning System:</b> Completion percentage and status are calculated automatically from material access and assessment scores to ensure accurate, verified learning progress.</span>
    </div>

    <nav className="learning-tabs" aria-label="Learning views">
      {[
        ['library', 'Course Library'],
        ['recommendations', 'Recommended for You'],
        ...(canAssign ? [['assign', 'Assign Courses']] : []),
        ['progress', employee ? 'My Progress' : 'Progress & Assessment'],
        ['gaps', 'Skill Gap Assignments'],
        ['completions', 'Verified Completions'],
        ...(hr ? [['ai', 'AI Insights']] : []),
      ].map(([key, label]) => (
        <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
          {key === 'recommendations' ? <><Sparkles className="inline w-3.5 h-3.5 mr-1 text-gray-700" /> {label}</> : key === 'gaps' ? <><Target className="inline w-3.5 h-3.5 mr-1" /> {label}</> : label}
        </button>
      ))}
    </nav>

    {/* ── LIBRARY TAB ── */}
    {tab === 'library' && (
      <section className="learning-section">
        {employee && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(17,24,39,0.06)', borderRadius: 10, border: '1px solid rgba(17,24,39,0.16)', marginBottom: 14, fontSize: 11, color: '#1f2937' }}>
            <Sparkles size={15} className="text-gray-900 flex-shrink-0" />
            <span><strong>Personalized Course Library:</strong> Showing courses recommended for your role and assigned development plan.</span>
          </div>
        )}
        <div className="learning-toolbar">
          <label className="learning-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses, providers, competencies…" aria-label="Search courses" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear">×</button>}</label>
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={provType} onChange={e => setProvType(e.target.value)} aria-label="Filter provider type"><option value="">All sources</option><option value="internal">Internal</option><option value="external">External</option></select>
          <select value={compFilter} onChange={e => setCompFilter(e.target.value)} aria-label="Filter competency"><option value="">All competencies</option>{competencies.map(c => <option key={c}>{c}</option>)}</select>
          {canManage && <label className="learning-archived"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>}
        </div>
        <div className="course-grid">
          {filtered.map(resource => {
            const hasVideo = !!(resource.video_url) || /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/)/i.test(resource.url || '')
            const hasPdf = !!(resource.pdf_url) || /\.pdf(\?.*)?$/i.test(resource.url || '') || (resource.url || '').includes('drive.google.com')
            const hasLesson = !!(resource.lesson_content)
            const empAssignment = assignments.find(a => a.resource_id === resource.id)
            return (
              <article className="course-card" key={resource.id}>
                <div className="course-top">
                  <span className={`course-badge ${resource.provider_type}`}>{resource.provider_type === 'internal' ? 'Internal' : 'External'}</span>
                  <span className="course-category">{resource.category}</span>
                  {resource.has_quiz && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: '#ede9fe', color: '#6d28d9', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ClipboardList size={10} /> Quiz
                    </span>
                  )}
                </div>
                <h3>{resource.title}</h3>
                <p className="course-provider"><b>{resource.provider || (resource.provider_type === 'internal' ? 'Company training' : 'External provider')}</b>{resource.duration_hours ? ` · ${resource.duration_hours}h` : ''}</p>
                <p className="course-desc">{resource.description}</p>
                {resource.objectives && <div className="course-objectives"><b>Objectives</b><ul>{resource.objectives.split(';').filter(Boolean).map((o, i) => <li key={i}>{o.trim()}</li>)}</ul></div>}
                {(resource.competencies || []).length > 0 && <div className="course-tags">{resource.competencies.map(c => <span key={c}>{c}</span>)}</div>}
                <div className="course-content-indicators">
                  {hasLesson && <span className="ccv-indicator lesson"><BookOpen size={11} /> Lesson</span>}
                  {hasVideo && <span className="ccv-indicator video"><Play size={11} /> Video</span>}
                  {hasPdf && <span className="ccv-indicator pdf"><FileText size={11} /> PDF</span>}
                </div>
                <div className="course-stats">
                  <span>{resource.assigned_count || 0} assigned</span>
                  <span>{resource.completed_count || 0} completed</span>
                </div>
                {/* Employee assignment status mini-pill */}
                {empAssignment && (
                  <div style={{ marginBottom: 4 }}>
                    <span className={`pill ${STATUS_PILL[empAssignment.status] || 'status not-started'}`} style={{ fontSize: 10 }}>
                      {STATUS_LABELS[empAssignment.status] || empAssignment.status} — {empAssignment.progress || 0}%
                    </span>
                  </div>
                )}
                <div className="course-actions">
                  <button className="ccv-open-btn" type="button" onClick={() => openCourseContent(resource, empAssignment)}>
                    <BookOpen size={13} /> View Content
                  </button>
                  {canManage && resource.is_active !== false && (
                    <>
                      <button onClick={() => editResource(resource)}>Edit</button>
                      <button className="danger" onClick={() => archive(resource)}>Archive</button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
          {!filtered.length && (
            <div className="learning-empty">
              {employee
                ? 'No recommended courses assigned yet. Your personalized courses will appear once your competency assessment and development plan are configured in Skill Development.'
                : (query || category || provType || compFilter ? 'No courses match your filters.' : 'No courses in the library yet.')}
            </div>
          )}
        </div>
      </section>
    )}

    {/* ── RECOMMENDATIONS TAB ── */}
    {tab === 'recommendations' && (
      <section className="learning-section">
        <div className="completion-note" style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.06), rgba(17,24,39,0.04))', borderColor: 'rgba(17,24,39,0.18)', marginBottom: 16 }}>
          <b style={{ color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={16} /> Gap-Based Learning Recommendations</b>
          <p style={{ marginTop: 4, marginBottom: 0 }}>Courses shown here are <b>strictly based on detected competency gaps</b> from the employee's assessment in Competency Management.</p>
        </div>
        {!employee && (
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.7)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Filter for Employee:</span>
            <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 220 }}>
              <option value="">— Select an employee —</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.job_title} · {emp.department})</option>)}
            </select>
            {recommendationsData?.relevantCompetencies?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
                <small style={{ fontSize: 10, color: '#64748b' }}>Skill Gaps Detected:</small>
                {recommendationsData.relevantCompetencies.slice(0, 4).map(c => (
                  <span key={c} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c' }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {recommendationsData?.notAssessed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(248,250,252,0.8)', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
            <AlertTriangle size={24} style={{ color: '#94a3b8', marginBottom: 14 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>No Competency Assessment Found</h3>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 420, margin: '0 0 16px', lineHeight: 1.6 }}>
              <b>{recommendationsData.employee?.name}</b> has not yet been evaluated in Competency Management. HR must first complete <b>Stage 1: Define Competency Requirements</b>.
            </p>
          </div>
        )}
        {recommendationsData?.noGaps && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(240,253,244,0.8)', borderRadius: 14, border: '1px solid #a7f3d0' }}>
            <CheckCircle size={24} style={{ color: '#10b981', marginBottom: 14 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#065f46', margin: '0 0 6px' }}>All Competencies On Track</h3>
            <p style={{ fontSize: 12, color: '#047857', maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
              <b>{recommendationsData.employee?.name}</b> meets or exceeds all required competency benchmarks.
            </p>
          </div>
        )}
        {!recommendationsData && !employee && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', background: 'rgba(248,250,252,0.8)', borderRadius: 14, border: '1px dashed #cbd5e1' }}>
            <Sparkles size={24} style={{ color: '#94a3b8', marginBottom: 14 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>Select an Employee</h3>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 360, margin: 0 }}>Select an employee from the dropdown above to view their gap-based course recommendations.</p>
          </div>
        )}
        {recommendationsData?.recommendedResources?.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button type="button" className="module-primary" style={{ background: 'linear-gradient(135deg,#111827,#111827)', border: 'none', color: '#fff', boxShadow: '0 4px 14px rgba(17,24,39,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 11 }}
                onClick={() => triggerGeneratePlan(selectedEmpId)} disabled={aiGeneratingPlan}>
                <Sparkles size={14} />
                <span>{aiGeneratingPlan ? 'AI Analyzing Skill Gaps...' : 'Generate AI Development Plan'}</span>
              </button>
            </div>
            <div className="course-grid">
              {recommendationsData.recommendedResources.map(resource => {
                const hasVideo = !!(resource.video_url) || /(?:youtu\.be\/|youtube\.com\/|vimeo\.com\/)/i.test(resource.url || '')
                const hasPdf = !!(resource.pdf_url) || /\.pdf(\?.*)?$/i.test(resource.url || '') || (resource.url || '').includes('drive.google.com')
                const hasLesson = !!(resource.lesson_content)
                const isCompleted = resource.assignment_status === 'completed'
                return (
                  <article className="course-card" key={resource.id} style={{ borderColor: '#e5e7eb', boxShadow: '0 4px 15px rgba(17,24,39,0.05)' }}>
                    <div className="course-top">
                      <span className={`course-badge ${resource.provider_type}`}>{resource.provider_type === 'internal' ? 'Internal' : 'External'}</span>
                      {isCompleted
                        ? <span className="course-category" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>✓ Resolved Gap</span>
                        : <span className="course-category" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>⚠ Gap Match</span>}
                    </div>
                    <h3>{resource.title}</h3>
                    <p className="course-provider"><b>{resource.provider || 'Hospitality Academy'}</b>{resource.duration_hours ? ` · ${resource.duration_hours}h` : ''}</p>
                    <p className="course-desc">{resource.description}</p>
                    <div className="course-tags">{(resource.competencies || []).map(c => <span key={c} style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>{c}</span>)}</div>
                    <div className="course-content-indicators">
                      {hasLesson && <span className="ccv-indicator lesson"><BookOpen size={11} /> Lesson</span>}
                      {hasVideo && <span className="ccv-indicator video"><Play size={11} /> Video</span>}
                      {hasPdf && <span className="ccv-indicator pdf"><FileText size={11} /> PDF</span>}
                    </div>
                    {resource.assignment_status && (
                      <div style={{ margin: '4px 0' }}>
                        <span className={`pill ${STATUS_PILL[resource.assignment_status] || 'status not-started'}`} style={{ fontSize: 10 }}>
                          {STATUS_LABELS[resource.assignment_status] || resource.assignment_status} — {Number(resource.assignment_progress || 0)}%
                        </span>
                      </div>
                    )}
                    <div className="course-actions" style={{ marginTop: 'auto', paddingTop: 10 }}>
                      <button className="ccv-open-btn" type="button" onClick={() => setViewResource(resource)}><BookOpen size={13} /> View Content</button>
                      {isCompleted
                        ? <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}><CheckCircle size={14} /> Completed</span>
                        : resource.assignment_status
                          ? <span style={{ fontSize: 10.5, fontWeight: 700, color: '#111827', marginLeft: 'auto' }}>In Progress ({Math.round(Number(resource.assignment_progress || 0))}%)</span>
                          : canAssign && (
                            <button type="button" style={{ marginLeft: 'auto', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700 }}
                              onClick={() => { setAssignResource(resource); if (selectedEmpId) setAssignIds([selectedEmpId]); setTab('assign') }}>
                              + Assign Module
                            </button>
                          )}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
        {recommendationsData && !recommendationsData.notAssessed && !recommendationsData.noGaps && recommendationsData.recommendedResources?.length === 0 && (
          <div className="learning-empty">Gaps detected but no matching courses found in the library yet. Add relevant courses and tag them with the competency names.</div>
        )}
      </section>
    )}

    {/* ── ASSIGN TAB ── */}
    {tab === 'assign' && (
      <section className="learning-section">
        {canAssign ? <>
          <div className="assign-layout">
            <div className="assign-col">
              <h2>1 · Select a course</h2>
              <div className="assign-courses">
                {resourcesForAssign.map(r => <button key={r.id} className={`assign-course ${assignResource?.id === r.id ? 'selected' : ''}`} onClick={() => setAssignResource(r)}>
                  <b>{r.title}</b><small>{r.category}{r.provider ? ` · ${r.provider}` : ''}{r.has_quiz ? ' · Quiz' : ''}</small>
                </button>)}
                {!resourcesForAssign.length && <p className="learning-empty">Add courses to the library first.</p>}
              </div>
            </div>
            <div className="assign-col">
              <div className="assign-emp-header">
                <h2>2 · Select employees</h2>
                {assignIds.length > 0 && <span className="assign-count-badge">{assignIds.length} selected</span>}
              </div>
              <div className="assign-emp-search-box">
                <input type="text" value={empQuery} onChange={e => setEmpQuery(e.target.value)} placeholder="Search by name, title, dept…" className="assign-emp-search-input" aria-label="Search employees" />
                {empQuery && <button type="button" onClick={() => setEmpQuery('')} className="assign-search-clear" aria-label="Clear">×</button>}
              </div>
              <div className="assign-emp-actions">
                <button type="button" className="assign-select-all-btn" onClick={() => {
                  const filteredIds = filteredEmployees.map(p => p.id)
                  const allSelected = filteredIds.length > 0 && filteredIds.every(id => assignIds.includes(id))
                  if (allSelected) setAssignIds(ids => ids.filter(id => !filteredIds.includes(id)))
                  else setAssignIds(ids => Array.from(new Set([...ids, ...filteredIds])))
                }}>
                  {filteredEmployees.length > 0 && filteredEmployees.every(p => assignIds.includes(p.id)) ? 'Deselect visible' : 'Select all visible'}
                </button>
              </div>
              <div className="assign-emp-search">
                {filteredEmployees.map(p => {
                  const isSelected = assignIds.includes(p.id)
                  return (
                    <label className={`assign-row ${isSelected ? 'selected' : ''}`} key={p.id}>
                      <span className="assign-avatar">{initials(p.full_name)}</span>
                      <div className="assign-row-info"><b>{p.full_name}</b><small>{p.job_title} · {p.department}</small></div>
                      <input type="checkbox" className="assign-checkbox" checked={isSelected} onChange={() => setAssignIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} aria-label={`Select ${p.full_name}`} />
                    </label>
                  )
                })}
                {!filteredEmployees.length && <p className="learning-empty">No matching employees found.</p>}
              </div>
            </div>
            <div className="assign-col">
              <h2>3 · Confirm assignment</h2>
              <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: '#3730a3', marginBottom: 12 }}>
                <Lock size={12} style={{ display: 'inline', marginRight: 4 }} /><b>Evidence-based tracking</b> starts automatically when the employee opens the course material. No manual progress updates needed.
              </div>
              <label>Due date (optional)<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
              <div className="assign-summary">
                <p><b>Course:</b> {assignResource ? assignResource.title : '—'}</p>
                <p><b>Employees:</b> {assignIds.length}</p>
                {assignResource?.has_quiz && (
                  <p style={{ color: '#6d28d9', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ClipboardList size={13} /> This course includes an auto-scored assessment (pass threshold: {assignResource.pass_threshold || 75}%)
                  </p>
                )}
              </div>
              <button className="module-primary" onClick={assign} disabled={!assignResource || !assignIds.length}>Assign course</button>
            </div>
          </div>
        </> : <div className="learning-empty">Only HR and supervisors can assign courses.</div>}
      </section>
    )}

    {/* ── PROGRESS TAB ── */}
    {tab === 'progress' && (
      <section className="learning-section">
        <h2 className="learning-block-title">{employee ? 'My learning assignments' : 'Learning assignments & assessment status'}</h2>
        {!employee && (
          <div className="completion-note">
            <b>Evidence-based progress</b>
            <p>Progress and status are calculated automatically from material access, assessment completion, and scores. Use "View Attempts" to see each employee's assessment history.</p>
          </div>
        )}
        <div className="assignment-list">
          {assignments.map(a => (
            <article className="assignment-row" key={a.id}>
              <div className="assignment-info">
                <b>{a.resource_title}</b>
                <small>{employee ? a.category : `${a.employee_name} · ${a.department}`}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
                <div className="assignment-badges">
                  <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || a.status}</span>
                  {a.is_completed && <span className="pill verified"><CheckCircle className="inline w-3 h-3 mr-0.5 text-emerald-500" /> Verified</span>}
                  {a.is_overridden && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ShieldCheck size={10} /> HR Override
                    </span>
                  )}
                  {a.fromCompetencyGap && <span className="pill gap-sourced" title="Assigned from a detected competency gap"><Target className="inline w-3 h-3 mr-0.5" /> From competency gap</span>}
                  {a.has_quiz && a.assessment_status === 'not_taken' && a.status !== 'not_started' && a.status !== 'in_progress' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: '#ede9fe', color: '#6d28d9', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ClipboardList size={10} /> Assessment ready
                    </span>
                  )}
                </div>
              </div>
              <div className="assignment-progress">
                <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
                <span>{a.progress || 0}%</span>
              </div>

              {/* Progress breakdown (transparent calculation) */}
              {a.progress_breakdown && Object.keys(a.progress_breakdown).length > 0 && (
                <ProgressBreakdown breakdown={a.progress_breakdown} />
              )}

              {/* Employee actions — evidence-based, no manual slider */}
              {employee && (
                <div className="assignment-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {/* Step 1: Access material */}
                  {a.status === 'not_started' && (
                    <button className="ccv-open-btn" type="button" onClick={() => openCourseContent(resources.find(r => r.id === a.resource_id) || { id: a.resource_id, title: a.resource_title }, a)}>
                      <BookOpen size={13} /> Start Course Material
                    </button>
                  )}
                  {/* Step 2: Mark material complete */}
                  {a.status === 'in_progress' && !a.material_completed && (
                    <>
                      <button className="ccv-open-btn" type="button" onClick={() => openCourseContent(resources.find(r => r.id === a.resource_id) || { id: a.resource_id, title: a.resource_title }, a)}>
                        <BookOpen size={13} /> Continue Material
                      </button>
                      <button className="module-secondary small" type="button" onClick={() => handleMaterialComplete(a)}>
                        <CheckCircle size={13} /> I've Finished the Material
                      </button>
                    </>
                  )}
                  {/* Step 3: Take assessment */}
                  {(a.status === 'assessment_pending' || (a.material_completed && a.assessment_status !== 'passed')) && a.has_quiz && (
                    <button className="module-primary small" type="button" onClick={() => setAssessmentTarget(a)} style={{ background: '#6366f1' }}>
                      <ClipboardList size={13} /> {a.attempts_count > 0 ? 'Retake Assessment' : 'Take Assessment'}
                    </button>
                  )}
                  {/* Completed */}
                  {a.status === 'completed' && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} /> Course Completed
                      {a.assessment_score != null && ` · Score: ${a.assessment_score}%`}
                    </span>
                  )}
                  {/* Needs improvement */}
                  {a.status === 'needs_improvement' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10.5, color: '#ef4444', fontWeight: 600 }}>Score: {a.assessment_score}% · Attempts: {a.attempts_count}</span>
                      {a.has_quiz && <button className="module-secondary small" type="button" onClick={() => setAssessmentTarget(a)}><RotateCcw size={12} /> Retake</button>}
                    </div>
                  )}
                </div>
              )}

              {/* HR/Supervisor monitoring actions */}
              {!employee && (
                <div className="assignment-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {a.assessment_score != null && (
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: a.assessment_status === 'passed' ? '#10b981' : '#ef4444' }}>
                      Score: {a.assessment_score}% · Attempts: {a.attempts_count}
                    </span>
                  )}
                  {a.has_quiz && (
                    <button className="module-secondary small" type="button" onClick={() => openMonitoring(a)}>
                      <BarChart2 size={12} /> View Attempts
                    </button>
                  )}
                  {!a.has_quiz && !a.is_completed && canAssign && (
                    <button className="module-secondary small" onClick={() => setCompleteTarget(a)}>Verify completion</button>
                  )}
                  {/* HR Override hidden in UI for now */}
                </div>
              )}
            </article>
          ))}
          {!assignments.length && <div className="learning-empty">No assignments yet.</div>}
        </div>
      </section>
    )}

    {/* ── GAPS TAB ── */}
    {tab === 'gaps' && (() => {
      const gapAssignments = assignments.filter(a => (a.competencies || []).length > 0)
      const gapVerified = completions.filter(c => gapAssignments.some(a => a.resource_id === c.resource_id && a.employee_id === c.employee_id)).length
      const gapActive = gapAssignments.filter(a => !a.is_completed).length
      return (
        <section className="learning-section">
          <div className="completion-note">
            <b>Skill Gap Assignments</b>
            <p>These courses were assigned from detected competency skill gaps. Completion is fully evidence-based — assessment pass required. Completing them automatically improves the linked competency score.</p>
          </div>
          <section className="module-metrics" style={{ marginBottom: 16 }}>
            {[['Gap assignments', gapAssignments.length], ['In progress / pending assessment', gapActive], ['Verified completions', gapVerified]].map(([label, val], i) => (
              <article key={label}><span>{i + 1}</span><div><small>{label}</small><b>{val}</b><em>Live value</em></div></article>
            ))}
          </section>
          <div className="assignment-list">
            {gapAssignments.map(a => (
              <article className="assignment-row" key={a.id}>
                <div className="assignment-info">
                  <b>{a.resource_title}</b>
                  <small>{employee ? '' : `${a.employee_name} · ${a.department} · `}{a.category}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</small>
                  <div className="assignment-badges">
                    {(a.competencies || []).map(c => <span key={c} className="pill gap-sourced" title={`Closes gap in ${c}`}><Target className="inline w-3 h-3 mr-0.5" /> {c}</span>)}
                    <span className={`pill ${STATUS_PILL[a.status] || 'status not-started'}`}>{STATUS_LABELS[a.status] || a.status}</span>
                    {a.is_completed && <span className="pill verified"><CheckCircle className="inline w-3 h-3 mr-0.5 text-emerald-500" /> Verified — competency improved</span>}
                  </div>
                </div>
                <div className="assignment-progress">
                  <div className="bar"><em style={{ width: `${a.progress || 0}%` }} /></div>
                  <span>{a.progress || 0}%</span>
                </div>
                {a.progress_breakdown && Object.keys(a.progress_breakdown).length > 0 && (
                  <ProgressBreakdown breakdown={a.progress_breakdown} />
                )}
                {employee && a.status === 'assessment_pending' && a.has_quiz && (
                  <div className="assignment-actions">
                    <button className="module-primary small" type="button" onClick={() => setAssessmentTarget(a)} style={{ background: '#6366f1' }}>
                      <ClipboardList size={13} /> Take Assessment
                    </button>
                  </div>
                )}
                {!employee && (
                  <div className="assignment-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {a.assessment_score != null && <span style={{ fontSize: 10.5, fontWeight: 600, color: a.assessment_status === 'passed' ? '#10b981' : '#ef4444' }}>Score: {a.assessment_score}% · Attempts: {a.attempts_count}</span>}
                    {a.has_quiz && <button className="module-secondary small" type="button" onClick={() => openMonitoring(a)}><BarChart2 size={12} /> View Attempts</button>}
                    {/* HR Override hidden in UI for now */}
                  </div>
                )}
              </article>
            ))}
            {!gapAssignments.length && <div className="learning-empty">No skill-gap assignments yet. Assign a course from a detected gap in <b>Competency Management → Skill Gaps & Learning</b>.</div>}
          </div>
        </section>
      )
    })()}

    {/* ── COMPLETIONS TAB ── */}
    {tab === 'completions' && (
      <section className="learning-section">
        <div className="completion-note">
          <b>Verified completions — evidence-based</b>
          <p>An employee is only recorded as completing a course when they have accessed the material AND passed the assessment (≥ pass threshold). HR overrides are marked and audit-logged.</p>
        </div>
        <div className="completion-list">
          {completions.map(c => (
            <article className="completion-row" key={c.id}>
              <span className="assign-avatar">{initials(c.employee_name)}</span>
              <div>
                <b>{c.resource_title}</b>
                <small>{c.employee_name} · {c.department}</small>
                {c.assessment_score != null && (
                  <div style={{ fontSize: 10.5, color: '#059669', marginTop: 2 }}>
                    Assessment score: <b>{c.assessment_score}%</b> · Attempts: <b>{c.attempts_count || 1}</b>
                    {c.is_overridden && (
                      <span style={{ marginLeft: 6, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <ShieldCheck size={11} /> HR Override
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span className="completion-date">Completed {new Date(c.completed_at).toLocaleDateString()}</span>
              <span className="pill complete">Completed</span>
            </article>
          ))}
          {!completions.length && <div className="learning-empty">No verified completions recorded yet.</div>}
        </div>
      </section>
    )}

    {/* ── AI INSIGHTS TAB ── */}
    {tab === 'ai' && (
      <section className="learning-section">
        <ModuleAIInsights module="learning" stage="completed" workflowId={null} />
      </section>
    )}

    {/* ── MODALS ── */}

    {/* Assessment modal (employee takes quiz) */}
    {assessmentTarget && (
      <AssessmentModal
        assignment={assessmentTarget}
        onClose={() => { setAssessmentTarget(null); load() }}
        onComplete={() => { load() }}
      />
    )}

    {/* HR Override modal */}
    {overrideTarget && (
      <OverrideModal
        assignment={overrideTarget}
        onClose={() => setOverrideTarget(null)}
        onDone={handleOverrideDone}
      />
    )}

    {/* HR Monitoring modal (attempt history) */}
    {monitoringTarget && createPortal(
      <div className="learning-modal-backdrop" role="dialog" aria-modal="true" onClick={() => { setMonitoringTarget(null); setMonitoringData(null) }}>
        <div className="learning-modal-dialog" style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div className="learning-modal-header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 size={18} /> Assessment Monitoring</h2>
              <p>{monitoringTarget.resource_title} — {monitoringTarget.employee_name}</p>
            </div>
            <button type="button" className="learning-modal-close-btn" onClick={() => { setMonitoringTarget(null); setMonitoringData(null) }}><X size={20} /></button>
          </div>
          <div className="learning-modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                ['Status', STATUS_LABELS[monitoringTarget.status] || monitoringTarget.status],
                ['Progress', `${monitoringTarget.progress || 0}%`],
                ['Assessment Score', monitoringTarget.assessment_score != null ? `${monitoringTarget.assessment_score}%` : 'Not taken'],
                ['Attempts', monitoringTarget.attempts_count || 0],
                ['Assessment Status', monitoringTarget.assessment_status || 'not_taken'],
                ['Material Done', monitoringTarget.material_completed ? 'Yes' : 'No'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>{String(v)}</div>
                </div>
              ))}
            </div>
            {monitoringTarget.progress_breakdown && Object.keys(monitoringTarget.progress_breakdown).length > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Progress Calculation</div>
                <ProgressBreakdown breakdown={monitoringTarget.progress_breakdown} />
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Assessment Attempt History</div>
            {!monitoringData && <div style={{ color: '#64748b', fontSize: 11 }}>Loading…</div>}
            {monitoringData && monitoringData.attempts.length === 0 && <div style={{ color: '#64748b', fontSize: 11 }}>No assessment attempts yet.</div>}
            {monitoringData && monitoringData.attempts.map(attempt => (
              <div key={attempt.id} style={{ background: attempt.passed ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${attempt.passed ? '#d1fae5' : '#fee2e2'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>Attempt #{attempt.attempt_number}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: attempt.passed ? '#10b981' : '#ef4444', padding: '2px 8px', borderRadius: 6, background: attempt.passed ? '#d1fae5' : '#fee2e2' }}>
                    {attempt.passed ? 'PASSED' : 'FAILED'} — {attempt.score}%
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
                  {attempt.correct_answers}/{attempt.total_questions} correct · {new Date(attempt.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="learning-modal-footer">
            <button type="button" className="module-secondary" onClick={() => { setMonitoringTarget(null); setMonitoringData(null) }}>Close</button>
          </div>
        </div>
      </div>,
      document.body,
    )}

    {/* Course form modal */}
    {showForm && createPortal(
      <div className="learning-modal-backdrop" role="dialog" aria-modal="true" aria-label="Course form" onClick={() => { setShowForm(false); setEditing(null) }}>
        <form onSubmit={save} className="learning-modal-dialog" onClick={event => event.stopPropagation()}>
          <div className="learning-modal-header">
            <div>
              <h2>{editing ? 'Edit course' : 'Add course to library'}</h2>
              <p>Describe the learning resource, its provider, and which competencies it supports.</p>
            </div>
            <button type="button" className="learning-modal-close-btn" onClick={() => { setShowForm(false); setEditing(null) }} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="learning-modal-body">
            <div className="learning-fields">
              <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
              <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Provider / source<input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="e.g. TESDA, Internal Training, Coursera" /></label>
              <label>Provider type<select value={form.providerType} onChange={e => setForm({ ...form, providerType: e.target.value })}>{PROV_TYPES.map(t => <option key={t} value={t}>{t === 'internal' ? 'Internal' : 'External'}</option>)}</select></label>
              <label>Duration (hours)<input type="number" min="0" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} /></label>
              <label>
                Pass threshold (%)
                <input type="number" min="0" max="100" value={form.passThreshold}
                  onChange={e => setForm({ ...form, passThreshold: Number(e.target.value) })}
                  title="Minimum assessment score required to pass this course" />
              </label>
              <label>URL / reference<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
              <label>Video URL (YouTube / Vimeo / direct)<input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=…" /></label>
              <label>PDF attachment URL<input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://…/module.pdf" /></label>
              <label className="full">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></label>
              <label className="full">Learning objectives<textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} placeholder="Separate objectives with semicolons (;)" /></label>
              <label className="full">
                Lesson content
                <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>Supports **bold**, *italic*, # Heading, - bullet list</span>
                <textarea value={form.lessonContent} onChange={e => setForm({ ...form, lessonContent: e.target.value })} rows={8} placeholder={"# Module Introduction\n\nWrite your lesson notes here."} />
              </label>
              <div className="full learning-competencies-block">
                <b>Related competencies</b>
                <div className="comp-picker">
                  {competencies.map(c => <label key={c} className={form.competencies.includes(c) ? 'selected' : ''}><input type="checkbox" checked={form.competencies.includes(c)} onChange={() => setForm(s => ({ ...s, competencies: s.competencies.includes(c) ? s.competencies.filter(x => x !== c) : [...s.competencies, c] }))} />{c}</label>)}
                  {!competencies.length && <small>No competencies available yet.</small>}
                </div>
              </div>
            </div>
          </div>
          <div className="learning-modal-footer">
            <button type="button" className="module-secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</button>
            <button type="submit" className="module-primary">{editing ? 'Save changes' : 'Add course'}</button>
          </div>
        </form>
      </div>,
      document.body,
    )}

    {/* HR legacy completion modal (for external courses without quiz) */}
    {completeTarget && createPortal(
      <div className="learning-modal-backdrop" role="dialog" aria-modal="true" aria-label="Verify completion" onClick={() => setCompleteTarget(null)}>
        <div className="learning-modal-dialog" style={{ maxWidth: 540 }} onClick={event => event.stopPropagation()}>
          <div className="learning-modal-header">
            <div>
              <h2>Verify completion (external course)</h2>
              <p>Officially record "{completeTarget.resource_title}" as completed for {completeTarget.employee_name}. Use only for external courses without an assessment quiz.</p>
            </div>
            <button type="button" className="learning-modal-close-btn" onClick={() => setCompleteTarget(null)} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="learning-modal-body">
            <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11, color: '#92400e', marginBottom: 12 }}>
              <b>⚠ Audit-logged</b> — This override will be recorded in the audit log.
            </div>
            <div className="learning-fields" style={{ gridTemplateColumns: '1fr' }}>
              <label className="full">Evidence / verification notes<textarea value={assessmentNote} onChange={e => setAssessmentNote(e.target.value)} placeholder="e.g., Employee submitted certificate from external training provider, verified on 2026-10-02." /></label>
            </div>
          </div>
          <div className="learning-modal-footer">
            <button type="button" className="module-secondary" onClick={() => setCompleteTarget(null)}>Cancel</button>
            <button type="button" className="module-primary" onClick={recordCompletion}>Confirm verification</button>
          </div>
        </div>
      </div>,
      document.body,
    )}

    {/* Course Content Viewer modal */}
    {viewResource && (
      <CourseContentViewer
        resource={viewResource}
        assignment={viewResourceAssignment}
        onClose={() => { setViewResource(null); setViewResourceAssignment(null) }}
        onMaterialComplete={viewResourceAssignment ? handleMaterialComplete : null}
        onTakeAssessment={viewResourceAssignment ? (a) => { setViewResource(null); setViewResourceAssignment(null); setAssessmentTarget(a) } : null}
      />
    )}

    {/* AI Development Plan Modal */}
    {planModalOpen && aiPlan && createPortal(
      <div className="er-modal-backdrop" role="dialog" aria-modal="true" aria-label="AI Development Plan" onClick={() => setPlanModalOpen(false)}>
        <div className="er-dialog er-history-modal" style={{ width: 'min(860px, 94vw)', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div className="er-history-header">
            <div className="er-history-user">
              <div className="er-history-avatar" style={{ background: 'linear-gradient(135deg,#111827,#111827)' }}><Sparkles size={20} /></div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800 }}>AI Competency Development Plan</h2>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(17,24,39,0.1)', color: '#111827' }}>AI Generated</span>
                </div>
                <p className="er-dialog-sub">Prepared for <b>{aiPlan.employeeName}</b> • {aiPlan.jobTitle} ({aiPlan.department}) • Estimated {aiPlan.timelineWeeks} Weeks Roadmap</p>
              </div>
            </div>
            <button className="er-history-close" onClick={() => setPlanModalOpen(false)} title="Close Plan"><X size={18} /></button>
          </div>
          <div style={{ background: 'linear-gradient(135deg,rgba(17,24,39,0.06),rgba(17,24,39,0.04))', border: '1px solid rgba(17,24,39,0.18)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> Executive Strategy Overview</h4>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, lineHeight: 1.5, color: '#334155' }}>{aiPlan.summary}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>{aiPlan.overview}</p>
          </div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} className="text-gray-900" /><span>Targeted Gap Resolution Pathways ({(aiPlan.gapPlans || []).length})</span></h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(aiPlan.gapPlans || []).map((gp, idx) => (
              <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f3e8ff', color: '#111827', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{idx + 1}</span>
                    <b style={{ fontSize: 13, color: '#0f172a' }}>{gp.competency}</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: gp.priority === 'High' ? '#fee2e2' : '#fef3c7', color: gp.priority === 'High' ? '#b91c1c' : '#b45309' }}>{gp.priority} Priority</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569' }}>Deficit: -{gp.gapPoints}% (Current {gp.currentScore}% → Target {gp.requiredScore}%)</span>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px', lineHeight: 1.45 }}><b>Role Relevance:</b> {gp.impact}</p>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>Prescribed 3-Step Action Sequence:</span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#1e293b', lineHeight: 1.5 }}>{(gp.actionSteps || []).map((step, sIdx) => <li key={sIdx}>{step}</li>)}</ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 6 }}>
                  <small style={{ fontSize: 10, color: '#64748b' }}><b>Matching Course:</b> {gp.recommendedCourse || 'Relevant Department SOP'}</small>
                  <button type="button" style={{ background: '#111827', color: '#ffffff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }} onClick={() => { setPlanModalOpen(false); setTab('library') }}>Open in Library →</button>
                </div>
              </div>
            ))}
          </div>
          {aiPlan.supervisorNotes && (
            <div style={{ marginTop: 16, background: '#fcfbff', border: '1px dashed #d1d5db', borderRadius: 10, padding: 12 }}>
              <b style={{ fontSize: 10.5, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 4 }}><Award size={13} /> Supervisor Coaching Guidance</b>
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#581c87', lineHeight: 1.4 }}>{aiPlan.supervisorNotes}</p>
            </div>
          )}
          <div className="module-actions" style={{ marginTop: 18, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 12 }}>
            <button className="cancel-button" onClick={() => setPlanModalOpen(false)}>Close Development Plan</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </main>
}
