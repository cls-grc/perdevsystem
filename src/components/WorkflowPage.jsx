import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SearchableSelector from './SearchableSelector'
import ModuleAIInsights from './ModuleAIInsights'
import WorkflowForms from './WorkflowForms'
import WorkflowTimeline from './WorkflowTimeline'
import ModuleDashboard from './ModuleDashboard'
import ModuleBusinessView from './ModuleBusinessView'
import useDialogFocus from '../hooks/useDialogFocus'
import { api } from '../lib/api'
import { configFor, computeModuleStats, STAGE_GUIDES, COMMENT_SUGGESTIONS, QUICK_DECISIONS, isApprovalStage } from '../workflowConfig'
import { getInitialValue } from './WorkflowForms'

const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').role
  } catch {
    return undefined
  }
}

const getUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').id
  } catch {
    return undefined
  }
}

const getEmployeeId = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').employeeId
  } catch {
    return undefined
  }
}

const moduleKeys = {
  'Performance review': 'performance',
  'Skill development': 'competency',
  'Learning progress': 'learning',
  'Training management': 'training',
  'Succession planning': 'succession',
  'Social recognition': 'recognition',
}

const slugify = text =>
  text
    ?.toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .trim() || ''

const normalizeStage = stage => {
  if (!stage) return null
  if (Array.isArray(stage)) {
    const [label, description = '', roles = []] = stage
    return { key: slugify(label), label, description, roles }
  }
  return {
    key: stage.key || slugify(stage.label),
    label: stage.label || '',
    description: stage.description || '',
    roles: stage.roles || [],
  }
}

// Generic success / error notification that fades after a few seconds.
function Notice({ notice, type = 'success', onDismiss }) {
  const timerRef = useRef(null)
  useEffect(() => {
    if (notice) {
      timerRef.current = setTimeout(onDismiss, 4500)
      return () => clearTimeout(timerRef.current)
    }
  }, [notice, onDismiss])
  if (!notice) return null
  return (
    <div className={`module-notice module-notice-${type}`}>
      <span>{type === 'success' ? '✓' : '!'} {notice}</span>
      <button type="button" className="notice-dismiss" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  )
}

export default function WorkflowPage({
  title,
  description,
  action,
  stages = [],
  items = [],
  itemLabel = 'Employee',
  module,
  itemIsEmployee = false,
  extraHeaderAction,
}) {
const role = getRole()
  const userId = getUserId()
  const employeeId = getEmployeeId()
  const moduleKey = module || moduleKeys[title]
  const moduleCfg = useMemo(() => configFor(moduleKey), [moduleKey])
const [workflow, setWorkflow] = useState(null)
  const [workflows, setWorkflows] = useState([])
  const [completedWorkflows, setCompletedWorkflows] = useState([])
  const [completedView, setCompletedView] = useState(null)
  const [completedEvents, setCompletedEvents] = useState([])
  const [definitions, setDefinitions] = useState([])
  const [events, setEvents] = useState([])
  const [analyticsData, setAnalyticsData] = useState(null)
  const [people, setPeople] = useState([])
  const [subject, setSubject] = useState(null)
  const [selected, setSelected] = useState(items[0] || ['', '', ''])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('success')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsStage, setDetailsStage] = useState(null)
const [bizOpen, setBizOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState('')
  const [returnNote, setReturnNote] = useState('')
const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
const [schedule, setSchedule] = useState({ date: '', time: '09:00', venue: 'Hotel Learning Hub' })
const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  // Per-step form data
  const [formData, setFormData] = useState({})
  // New workflow composer state (clean slate for each new cycle)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerEmployee, setComposerEmployee] = useState(null)
  const [composerDept, setComposerDept] = useState('')
  const [composerQuery, setComposerQuery] = useState('')
  // Unified subject selector — the live "currently evaluating" target. Updated
  // as soon as the user picks an employee in the composer or the top selector,
  // before any workflow is created.
  const [evaluatingSubject, setEvaluatingSubject] = useState(null)
  // The most recently completed workflow — retained only for the AI panel so
  // HR can generate a report immediately after completion. It is NOT the
  // active workflow and never appears in the active workspace.
  const [lastCompleted, setLastCompleted] = useState(null)
  // The most recently selected workflow id from the completed history, used to
  // target the AI Insights panel so its "Generate AI Insight" button acts on
  // that specific employee/module workflow. Selecting it never auto-generates.
  const [aiTargetWorkflowId, setAiTargetWorkflowId] = useState(null)

  const roleAction = typeof action === 'string' ? action : action?.[role]
  const itemOptions = useMemo(
    () => items.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [items],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
const [list, completedList, definitionResult, subjectResult] = await Promise.all([
        api.workflows(moduleKey),
        api.workflows(moduleKey, { status: 'completed' }),
        api.workflowDefinitions(),
        api.workflowSubjects(),
      ])
// Only an IN-PROGRESS workflow can be the active workspace item.
      // Completed workflows belong in history/reports/AI, never in the active view.
      const active = (list.workflows || []).find(w => w.status === 'active') || null
      setWorkflows(list.workflows || [])
      setCompletedWorkflows(completedList.workflows || [])
      setDefinitions(definitionResult.workflows[moduleKey] || [])
      setPeople(subjectResult.employees || [])
      setSubject(previous => previous || subjectResult.employees?.[0] || null)
      setWorkflow(active)
      setEvents(active ? (await api.workflow(active.id)).events || [] : [])
      setError('')
      // Load analytics for dashboard stats
      const analytics = await api.analytics().catch(() => null)
      setAnalyticsData(analytics)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [moduleKey])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load()
  }, [load])

  const normalizedStages = useMemo(() => {
    if (definitions.length) return definitions
    return stages.map(normalizeStage).filter(Boolean)
  }, [definitions, stages])

const current = normalizedStages.find(stage => stage.key === workflow?.current_stage)
  // Include stages the user can act on: their assigned-role stages, plus any
  // employee-assigned stage where they are the workflow's subject.
  const roleStages = useMemo(
    () => normalizedStages.filter(stage =>
      stage.roles.includes(role) ||
      (workflow && stage.roles.length === 1 && stage.roles[0] === 'employee' && Boolean(employeeId && workflow.subject_employee_id && employeeId === workflow.subject_employee_id)),
    ),
    [normalizedStages, role, workflow?.subject_employee_id, employeeId],
  )
const canStart = Boolean(normalizedStages[0]?.roles.includes(role))
  // The actor may act if their role is assigned to the current stage, OR if the
  // stage is employee-assigned and the actor IS the workflow's subject (so the
  // subject can complete their own self-assessment regardless of role label).
  const canAct = Boolean(
    workflow &&
    current &&
    (current.roles.includes(role) ||
      (current.roles.length === 1 && current.roles[0] === 'employee' && Boolean(employeeId && workflow.subject_employee_id && employeeId === workflow.subject_employee_id))),
  )
  const assigned = itemIsEmployee
    ? people.find(person => person.full_name.toLowerCase() === selected[0].toLowerCase())
    : subject
  const roleCurrentIndex = workflow ? roleStages.findIndex(stage => stage.key === workflow?.current_stage) : -1
  const display = current?.label || normalizedStages[0]?.label || 'Workflow'
  const currentDescription = current?.description || 'Review the current step details and complete when ready.'
  const detailTarget = detailsStage || current
  const canReturn = Boolean(workflow && canAct && roleCurrentIndex > 0)
  const canCancel = Boolean(workflow && (role === 'hr' || userId === workflow.created_by))
  const previousStageOptions = workflow && canAct
    ? normalizedStages
        .filter(stage => stage.key !== workflow.current_stage && roleStages.findIndex(s => s.key === stage.key) < roleCurrentIndex)
        .map(stage => ({ value: stage.key, label: stage.label }))
    : []

// Current step form config from moduleCfg
  const currentFormConfig = useMemo(() => {
    if (!workflow || !current) return null
    return moduleCfg.stepForms[workflow.current_stage] || null
  }, [workflow, current, moduleCfg])

  // Is the current step an approval step? If so, show "Approve & Continue" +
  // "Return for Revision"; otherwise show a single "Complete Step" action. The
  // two action styles are mutually exclusive (no duplicate buttons).
  const isApproval = useMemo(
    () => Boolean(workflow && current && isApprovalStage(current.key, currentFormConfig)),
    [workflow, current, currentFormConfig],
  )

  // Step guidance card + comment suggestion chips for the current stage.
  const currentGuide = useMemo(() => {
    if (!current) return null
    const byModule = STAGE_GUIDES[moduleKey] || {}
    return byModule[current.key] || null
  }, [current, moduleKey])

  const currentSuggestions = useMemo(() => COMMENT_SUGGESTIONS[moduleKey] || [], [moduleKey])
  const quickDecisionNote = useMemo(() => QUICK_DECISIONS[moduleKey] || null, [moduleKey])

const currentFormValue = useMemo(() => {
    const key = workflow?.current_stage || ''
    return formData[key] !== undefined ? formData[key] : {}
  }, [formData, workflow?.current_stage])

  // Bidirectional alignment: picking a subject in the unified selector (top of
  // the module) also fills the step form's "Employee to evaluate" field, and
  // vice versa. This keeps the two selection points in sync.
  const hasEmployeeField = useMemo(() =>
    Boolean(currentFormConfig && (currentFormConfig.fields || []).some(f => f.name === 'employee')),
    [currentFormConfig],
  )

  useEffect(() => {
    if (!workflow || !hasEmployeeField) return
    const key = workflow.current_stage
    if (evaluatingSubject?.full_name && currentFormValue?.employee !== evaluatingSubject.full_name) {
      setFormData(prev => {
        const current = prev[key] || {}
        if (current.employee === evaluatingSubject.full_name) return prev
        return { ...prev, [key]: { ...current, employee: evaluatingSubject.full_name } }
      })
    }
  }, [evaluatingSubject, workflow, hasEmployeeField, currentFormValue?.employee]) // eslint-disable-line react-hooks/exhaustive-deps

// When the workflow moves to a new stage, seed a fresh initial value for the
  // stage's form/builder so the step always has a valid controlled value.
  useEffect(() => {
    if (!workflow || !currentFormConfig) return
    const key = workflow.current_stage
    if (formData[key] !== undefined) return
    const initial = getInitialValue(currentFormConfig, role)
    // Auto-invite the workflow's subject on participant-invite steps (e.g. the
    // training "Invite participants" step). The participant chosen when the
    // cycle started is automatically included, so HR doesn't have to re-select
    // them; additional participants can still be added on top.
if (initial !== undefined) {
      const inviteNames = (currentFormConfig.fields || []).find(f => f.name === 'invitees' || f.name === 'participants')
      const isAssignBuilder = currentFormConfig.builder === 'assignEmployees'
      const isNominationsBuilder = currentFormConfig.builder === 'nominations'
      const subjectName = workflow?.subject_name
      let seeded = initial
      if (isNominationsBuilder && subjectName && Array.isArray(initial)) {
        // Succession nomination: the candidate chosen when the cycle started is
        // automatically pre-filled so the department head doesn't re-enter it.
        const already = initial.some(row => row && row.employee === subjectName)
        seeded = already ? initial : [...initial, { employee: subjectName, rationale: '', targetRole: '' }]
      } else if (isAssignBuilder && subjectName && Array.isArray(initial)) {
        seeded = initial.includes(subjectName) ? initial : [...initial, subjectName]
      } else if (inviteNames && Array.isArray(initial[inviteNames.name])) {
        const list = initial[inviteNames.name]
        seeded = { ...initial, [inviteNames.name]: list.includes(subjectName) ? list : [...list, subjectName] }
      }
      setFormData(prev => (prev[key] !== undefined ? prev : { ...prev, [key]: seeded }))
    }
  }, [workflow?.current_stage, currentFormConfig, role, workflow?.subject_name]) // eslint-disable-line react-hooks/exhaustive-deps

const setFormValue = useCallback((patchOrValue, meta) => {
    const key = workflow?.current_stage || ''
    // If the form's "employee" field changed, sync the unified subject selector.
    const nextValue = patchOrValue && typeof patchOrValue === 'object' && !Array.isArray(patchOrValue)
      ? { ...(patchOrValue) }
      : patchOrValue
    if (nextValue && typeof nextValue === 'object' && nextValue.employee) {
      const match = people.find(p => p.full_name === nextValue.employee)
      if (match) setEvaluatingSubject(match)
    }
    if (meta?.submit) {
      // Form submitted — store the data and proceed with completion
      setFormData(prev => ({ ...prev, [key]: patchOrValue }))
      setConfirmAction(() => complete)
      setConfirmOpen(true)
      return
    }
    setFormData(prev => ({ ...prev, [key]: patchOrValue }))
  }, [workflow?.current_stage, people])

// Check if form is valid for the current step
  const isFormValid = useMemo(() => {
    if (!currentFormConfig) return true // no form config = allow
    if (currentFormConfig.aiOnly) return true // no fields needed for AI steps
    if (currentFormConfig.builder === 'calibration') {
      const v = currentFormValue
      const decision = v?.decision || ''
      if (!decision) return false
      if (decision === 'Override Final Score' && (v?.finalScore === '' || v?.finalScore === undefined || v?.finalScore === null)) return false
      if ((decision === 'Override Final Score' || decision === 'Return for Reassessment') && !String(v?.reason || '').trim()) return false
      return true
    }
    const fields = currentFormConfig.fields || []
    return fields.every(field => {
      if (!field.required) return true
      const v = currentFormValue[field.name]
      if (Array.isArray(v)) return v.length > 0
      if (field.type === 'toggle') return Boolean(v)
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
  }, [currentFormConfig, currentFormValue])

  // Live items: when the page uses employees as items, prefer real records from the API.
  const liveItems = useMemo(() => {
    if (!itemIsEmployee || !people.length) return items
    return people.map(person => [person.full_name, `${person.job_title} - ${person.department}`, 'Active', (person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()])
  }, [itemIsEmployee, people, items])

  const liveItemOptions = useMemo(
    () => liveItems.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [liveItems],
  )

const showNotice = (msg, type = 'success') => {
    setNotice(msg)
    setNoticeType(type)
  }

// Reset all per-workflow state so a brand-new workflow starts completely fresh.
  const resetWorkflowState = () => {
    setFormData({})
    setNote('')
    setWorkflow(null)
    setEvents([])
    setSelected(items[0] || ['', '', ''])
    setReturnTarget('')
    setReturnNote('')
    setCancelReason('')
    setConfirmOpen(false)
    setConfirmAction(null)
  }

  // Core workflow creation. Resets all state first so nothing from the previous
  // workflow (employee, forms, ratings, KPIs, notes, AI panel) leaks into the
  // new cycle. Always creates a genuinely new workflow_id.
const start = async (options = {}) => {
    // Prefer an employee chosen in the create-step form (selection-first UX),
    // then the composer selection, then the unified subject selector, then the
    // currently assigned subject.
    const formEmployee = currentFormValue?.employee
    const selectedFromForm = formEmployee && people.find(p => p.full_name === formEmployee)
    const targetEmployee = options.employee || selectedFromForm || evaluatingSubject || (role === 'employee' ? null : assigned)
    if (role !== 'employee' && !targetEmployee) return setError(`Select a valid ${itemLabel.toLowerCase()} first.`)
    if (targetEmployee) setEvaluatingSubject(targetEmployee)
    showNotice(`Creating ${title.toLowerCase()} workflow...`)
    setError('')
    setSaving(true)
    try {
      const result = await api.createWorkflow({
        module: moduleKey,
        title: `${title}: ${targetEmployee?.full_name || selected[0]}`,
        subjectEmployeeId: role === 'employee' ? undefined : targetEmployee?.id,
        metadata: {
          selectedItem: targetEmployee?.full_name || selected[0],
          selectedItemStatus: 'Active',
          assignedEmployee: targetEmployee?.full_name,
          ...(options.trainingSchedule ? { trainingSchedule: options.trainingSchedule } : {}),
        },
      })
      if (options.trainingSchedule) {
        await api.addWorkflowNote(result.workflow.id, {
          note: `Training scheduled: ${options.trainingSchedule.date} at ${options.trainingSchedule.time}, ${options.trainingSchedule.venue}.`,
          data: { type: 'training_schedule', ...options.trainingSchedule, training: selected[0] },
        })
      }
      // Clear the composer after a successful create.
      setComposerOpen(false)
      setComposerEmployee(null)
      setComposerDept('')
      setComposerQuery('')
      resetWorkflowState()
      showNotice(`${roleAction || 'Workflow'} created. Starting at Step 1.`)
      await load()
    } catch (requestError) {
      setNotice('')
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const begin = () => {
    setError('')
    void start()
  }

// Create a new workflow through the composer (employee pre-selected).
  const createFromComposer = () => {
    // The selection may be stored in composerEmployee (clicked a result card)
    // OR in evaluatingSubject (picked from the datalist dropdown, which clears
    // composerEmployee). Accept either so a valid selection is never rejected.
    const target = composerEmployee || evaluatingSubject
    if (!target) return setError('Select an employee to start the workflow.')
    setError('')
    setEvaluatingSubject(target)
    void start({ employee: target })
  }

  const openAssignedAction = () => {
    setError('')
    const assignedWorkflow = workflows.find(entry => {
      const stage = normalizedStages.find(candidate => candidate.key === entry.current_stage)
      return stage?.roles.includes(role)
    })
    if (!assignedWorkflow) {
      showNotice(`There are no ${title.toLowerCase()} actions waiting for your role.`, 'info')
      return
    }
    void chooseWorkflow(assignedWorkflow.id)
    showNotice(`${roleAction} is ready in the selected workflow.`)
  }

const handleHeaderAction = () => {
    if (canStart) {
      // Open the New Workflow composer so the user picks a fresh employee and
      // a brand-new cycle starts from scratch.
      setComposerOpen(true)
      return
    }
    openAssignedAction()
  }

const complete = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await api.advanceWorkflow(workflow.id, {
        note: note || undefined,
        data: { selectedItem: selected[0], formData: currentFormValue, ...currentFormValue },
      })
      setNote('')
      setConfirmOpen(false)
      if (result.completed) {
        // Keep the just-completed workflow id for the AI panel (so HR can
        // generate a report immediately), then clear the active workspace so
        // the completed workflow moves to history only.
        setLastCompleted(workflow)
        setWorkflow(null)
        setEvents([])
        showNotice('✓ Workflow completed. Metrics calculated — you can generate the AI report now.')
      } else {
        showNotice(`${display} completed. ${result.nextAction} is now awaiting its assigned role.`)
      }
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  // Execute the current step immediately after validation — no confirmation
  // modal for non-destructive actions. The button itself performs the action.
  const handleCompleteWithValidation = () => {
    if (currentFormConfig && !isFormValid) {
      setError('Please complete all required fields before submitting this step.')
      return
    }
    void complete()
  }

  // One-click approval: approve the current step and continue.
  const approveAndContinue = () => {
    if (!workflow || !canAct) return
    if (currentFormConfig && !isFormValid) {
      setError('Please complete all required fields before approving this step.')
      return
    }
    setNote(quickDecisionNote?.approve || 'Approved')
    void complete()
  }

  // One-click return for revision on an approval step.
  const returnForRevision = () => {
    if (!workflow || !canAct) return
    if (canReturn) {
      setReturnTarget(previousStageOptions[0]?.value || '')
      setReturnNote(quickDecisionNote?.reject || 'Returned for revision')
      setReturnOpen(true)
    } else {
      setNote(quickDecisionNote?.reject || 'Returned for revision')
      void complete()
    }
  }

const quickAction = action => {
    const stage = normalizedStages.find(s => s.key === action.stage)
    if (!stage) return
    if (stage.roles.includes(role)) {
      if (workflow?.current_stage === stage.key) return
      // If no workflow at this stage, start one
      if (canStart) begin()
    }
  }

  // One-click approve / reject decision for review stages.
  const quickApprove = () => {
    if (!workflow || !canAct) return
    setNote(quickDecisionNote?.approve || 'Approved')
    setConfirmAction(() => complete)
    setConfirmOpen(true)
  }
  const quickReject = () => {
    if (!workflow || !canAct) return
    setNote(quickDecisionNote?.reject || 'Returned for revision')
    if (canReturn) {
      setReturnTarget(previousStageOptions[0]?.value || '')
      setReturnNote(quickDecisionNote?.reject || 'Returned for revision')
      setReturnOpen(true)
    } else {
      setConfirmAction(() => complete)
      setConfirmOpen(true)
    }
  }

  const saveNote = async () => {
    if (!note.trim()) return setError('Add a note before saving.')
    setSaving(true)
    try {
      await api.addWorkflowNote(workflow.id, { note, data: { selectedItem: selected[0] } })
      setNote('')
      showNotice('Note saved to the database audit history.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const returnWorkflow = async () => {
    if (!workflow) return
    if (!returnTarget) return setError('Select a stage to return the workflow to.')
    setSaving(true)
    setError('')
    try {
      const result = await api.returnWorkflow(workflow.id, {
        targetStage: returnTarget,
        note: returnNote || undefined,
        data: { selectedItem: selected[0] },
      })
      setReturnOpen(false)
      setReturnTarget('')
      setReturnNote('')
      showNotice(`Workflow returned to "${result.returnedTo}" for the assigned role to redo.`)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const cancelWorkflow = async () => {
    if (!workflow) return
    if (!cancelReason.trim()) return setError('Provide a reason before cancelling.')
    setSaving(true)
    setError('')
    try {
      await api.cancelWorkflow(workflow.id, cancelReason.trim())
      setCancelOpen(false)
      setCancelReason('')
      showNotice('Workflow cancelled and recorded in the audit history.', 'info')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

const chooseWorkflow = async id => {
    const active = workflows.find(entry => entry.id === id)
    if (!active) return
    setWorkflow(active)
    try {
      setEvents((await api.workflow(id)).events || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

// View a completed workflow's full history (RBAC-aware). HR / management /
  // operations_manager / supervisor can view any completed workflow in their
  // module; employees can only view workflows where they are the subject.
  // Selecting a workflow only targets the AI Insights panel — it does NOT
  // auto-generate. AI generation happens ONLY when the user clicks the
  // explicit "Generate AI Insight" button inside the AI Insights panel.
  const viewCompletedWorkflow = async (id) => {
    setError('')
    try {
      const result = await api.workflow(id)
      setCompletedView(result.workflow)
      setCompletedEvents(result.events || [])
      // Target the AI Insights panel at this specific completed workflow so HR
      // (or the employee owner) can generate its insight from the panel button.
      setAiTargetWorkflowId(id)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const closeCompletedView = () => {
    setCompletedView(null)
    setCompletedEvents([])
  }

const saveSchedule = async () => {
    if (!schedule.date) return setError('Select a training date.')
    if (!workflow) {
      setScheduleOpen(false)
      await start(schedule)
      return
    }
    setSaving(true)
    try {
      await api.addWorkflowNote(workflow.id, {
        note: `Training scheduled: ${schedule.date} at ${schedule.time}, ${schedule.venue}.`,
        data: { type: 'training_schedule', ...schedule, training: selected[0] },
      })
      setScheduleOpen(false)
      showNotice('Verified training schedule saved.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  // Focus management for each dialog.
  const detailsRef = useDialogFocus(detailsOpen, () => { setDetailsOpen(false); setDetailsStage(null) })
  const scheduleRef = useDialogFocus(scheduleOpen, () => setScheduleOpen(false))
  const returnRef = useDialogFocus(returnOpen, () => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') })
  const cancelRef = useDialogFocus(cancelOpen, () => { setCancelOpen(false); setCancelReason('') })
  const confirmRef = useDialogFocus(confirmOpen, () => setConfirmOpen(false))

  if (loading) return <main className="module-workspace"><div className="dashboard-skeleton"><i /><i /><i /><i /></div></main>

  const personOptions = people.map(person => ({ value: person.id, label: person.full_name, description: `${person.job_title} - ${person.department}` }))
  const stats = [
    ['Active workflows', workflows.length],
    ['Current stage', workflow ? display : 'Not started'],
    ['Audit entries', events.length],
    ['Last updated', workflow ? new Date(workflow.updated_at).toLocaleTimeString() : '-'],
  ]

  // compute overall progress based on stage index
  const stageProgress = current && normalizedStages.length
    ? Math.round(((normalizedStages.findIndex(s => s.key === current.key) + 1) / normalizedStages.length) * 100)
    : 0

  return <main className="module-workspace">
    <div className="module-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {(extraHeaderAction || roleAction) && <div className="module-heading-actions">
        {roleAction && <button className="module-primary" type="button" onClick={handleHeaderAction} disabled={saving}>{saving ? 'Creating...' : roleAction}</button>}
        {extraHeaderAction}
      </div>}
    </div>

    {notice && <Notice notice={notice} type={noticeType} onDismiss={() => setNotice('')} />}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => { setError(''); void load() }}>Retry</button></div>}

{/* Module-specific dashboard widgets */}
    <ModuleDashboard
      moduleKey={moduleKey}
      data={analyticsData}
      workflows={workflows}
      role={role}
      onQuickAction={quickAction}
    />

{/* Module-specific business workspace — distinct identity per module,
        driven entirely by live analytics + workflow data. Collapsible so the
        workflow process stays front and center by default. */}
    <section className="module-biz-collapsible">
      <button
        type="button"
        className={`module-biz-toggle ${bizOpen ? 'open' : ''}`}
        onClick={() => setBizOpen(o => !o)}
        aria-expanded={bizOpen}
      >
        <span className="module-biz-toggle-icon">{bizOpen ? '▾' : '▸'}</span>
        <span className="module-biz-toggle-label">Analytics overview</span>
        <span className="module-biz-toggle-hint">{bizOpen ? 'Hide' : 'Show'}</span>
      </button>
      {bizOpen && (
        <div className="module-biz-panel">
          <ModuleBusinessView
            moduleKey={moduleKey}
            data={analyticsData}
            workflows={workflows}
            completedWorkflows={completedWorkflows}
          />
        </div>
      )}
    </section>

<section className="module-metrics">
      {stats.map(([label, value], index) => <article key={label}><span>{index + 1}</span><div><small>{label}</small><b>{value}</b><em>Live database value</em></div></article>)}
    </section>

    <section className="module-grid">
      <section className="module-process">
        <div className="module-process-head">
          <span>{workflow ? (canAct ? 'Action required' : 'Read-only status') : 'Ready to start'}</span>
          <b>{display}</b>
        </div>

{/* Step stepper — richer states: complete / current / upcoming / locked / ai / finalized */}
        <div className="module-steps">
          {roleStages.map((stage, index) => {
            const isAi = moduleCfg?.stepForms?.[stage.key]?.aiOnly
            const isFinalized = workflow?.status === 'completed'
            let stStatus
            if (isFinalized) {
              stStatus = 'finalized'
            } else if (workflow) {
              stStatus = index < roleCurrentIndex ? 'complete' : index === roleCurrentIndex ? 'active' : 'pending'
            } else {
              stStatus = index === 0 && canStart ? 'active' : 'locked'
            }
            const statusLabel = isFinalized
              ? 'Finalized'
              : isAi
                ? 'AI stage'
                : stStatus === 'complete' ? 'Completed'
                  : stStatus === 'active' ? 'Current step'
                    : stStatus === 'locked' ? 'Locked' : 'Upcoming'
            return (
              <div
                key={stage.key}
                className={`module-step ${stStatus} ${isAi ? 'ai-step' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => { setDetailsStage(stage); setDetailsOpen(true) }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailsStage(stage); setDetailsOpen(true) } }}
              >
                <div className="step-marker">{isFinalized ? '✓' : stStatus === 'complete' ? '✓' : isAi ? '✦' : index + 1}</div>
                <div className="step-copy"><b>{stage.label}</b><small>{statusLabel}</small></div>
              </div>
            )
          })}
        </div>

        {/* Step details and form */}
        <div className="module-content">
          <h2>{display}</h2>
          <p>{workflow ? currentDescription : canStart ? 'Select a record, then start the workflow.' : 'Your role does not have a start action for this workflow.'}</p>

{/* Dynamic subject indicator + unified subject selector.
              The "Currently evaluating" label updates live as the user picks an
              employee (composer or this selector), before any workflow exists,
              and falls back to the active workflow's subject. */}
<div className="module-subject-bar">
            <span className="module-current-subject">
              <strong>Currently evaluating:</strong>{' '}
              {workflow ? (
                <em className="subject-fixed">{workflow.subject_name || 'Unassigned'}</em>
              ) : (
                evaluatingSubject?.full_name || 'None selected'
              )}
            </span>
            {!workflow && canStart && people.length > 0 && (
              <div className="module-subject-select">
                <input
                  className="module-subject-search"
                  value={evaluatingSubject ? evaluatingSubject.full_name : ''}
                  onFocus={event => (event.target.value = '')}
                  onChange={event => {
                    const q = event.target.value
                    const match = people.find(p => p.full_name.toLowerCase() === q.trim().toLowerCase())
                    setEvaluatingSubject(match || null)
                  }}
                  placeholder="Search & select subject to evaluate…"
                  list="module-subject-list"
                  aria-label="Select subject to evaluate"
                />
                <datalist id="module-subject-list">
                  {people.map(person => <option key={person.id} value={person.full_name}>{person.job_title} · {person.department}</option>)}
                </datalist>
              </div>
            )}
          </div>

{workflow ? (
            <>
              {/* Step guidance card — current task / action / time / checklist */}
              {currentGuide && (
                <div className="step-guide-card">
                  <div className="step-guide-head">
                    <span>Current task</span>
                    <em>~{currentGuide.time}</em>
                  </div>
                  <h4>{currentGuide.task}</h4>
                  <p>{currentGuide.action}</p>
                  <ul className="step-guide-checklist">
                    {currentGuide.checklist.map(item => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
              )}

{/* Per-step business form */}
              {currentFormConfig && !currentFormConfig.aiOnly && (
                <div className="workflow-form-wrap">
<WorkflowForms
                    formConfig={currentFormConfig}
                    value={currentFormValue}
                    onChange={setFormValue}
                    role={role}
                    people={people}
                    suggestions={currentSuggestions}
                    events={events}
                    subject={workflow ? { id: workflow.subject_employee_id, full_name: workflow.subject_name } : evaluatingSubject}
                  />
                </div>
              )}

              {/* AI-only step — no business form, just the AI insights panel */}
              {currentFormConfig?.aiOnly && (
                <div className="workflow-ai-step">
                  <p>This step requires reviewing the AI-generated insights and confirming completion below.</p>
                </div>
              )}

{canAct ? (
                isApproval ? (
                  <>
                    <label className="collapsible-block">
                      <span className="collapsible-toggle">✎ Add approval note (optional)</span>
                      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add an approval note or review comment for this step." rows={2} />
                    </label>
                    <div className="module-actions single-action">
                      <button className="module-primary approve-continue" disabled={saving || (!isFormValid && Boolean(currentFormConfig))} onClick={approveAndContinue}>
                        {saving ? 'Approving...' : 'Approve & Continue'}
                      </button>
                      <button className="module-secondary return-button" disabled={saving} onClick={returnForRevision}>Return for Revision</button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="collapsible-block">
                      <span className="collapsible-toggle">✎ Add note or review comment (optional)</span>
                      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add a note or review comment for this step." rows={2} />
                    </label>
                    <div className="module-actions single-action">
                      <button className="module-primary" disabled={saving || (!isFormValid && Boolean(currentFormConfig))} onClick={handleCompleteWithValidation}>
                        {saving ? 'Completing...' : 'Complete Step'}
                      </button>
                    </div>
                  </>
                )
              ) : (
                <p>This workflow is currently assigned to another role. No action controls are available.</p>
              )}
              {canCancel && (
                <div className="module-actions module-cancel-row">
                  <button className="module-secondary cancel-button" disabled={saving} onClick={() => setCancelOpen(true)}>Cancel workflow</button>
                </div>
              )}
            </>
) : (
            <div className="workflow-empty-state">
              <div className="workflow-empty-illustration">📋</div>
              <h3>No active workflow</h3>
              <p>{canStart ? `Start a new ${title.toLowerCase()} to begin.` : 'Your role does not have a start action for this workflow.'}</p>
              {canStart && (
                <button className="module-primary" type="button" disabled={saving} onClick={() => setComposerOpen(true)}>
                  {saving ? 'Creating...' : 'Create New Workflow'}
                </button>
              )}
            </div>
          )}

{workflows.length > 0 && (
            <div className="workflow-picker-wrap">
              <label className="workflow-picker-label">Active workflow</label>
              <select className="workflow-picker" value={workflow?.id || ''} onChange={event => chooseWorkflow(event.target.value)} aria-label="Select active workflow">
                {workflows.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
              </select>
            </div>
          )}

{/* Completed workflow history — RBAC-aware. HR / management / operations_manager
              / supervisor can browse all completed workflows; employees can only see
              the ones where they were the subject (enforced server-side). */}
          {completedWorkflows.length > 0 && (
            <div className="completed-workflows-wrap">
              <h3 className="completed-workflows-title">Completed workflow history</h3>
              <ul className="completed-workflows-list">
                {completedWorkflows.map(entry => (
                  <li key={entry.id} className="completed-workflow-item">
                    <div className="completed-workflow-copy">
                      <b>{entry.title}</b>
                      <small>{entry.subject_name || 'Unassigned'} · completed {new Date(entry.completed_at || entry.updated_at).toLocaleDateString()}</small>
                    </div>
                    <button className="module-secondary" type="button" onClick={() => viewCompletedWorkflow(entry.id)}>
                      View history
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      <ModuleAIInsights module={moduleKey} stage={display} workflowId={aiTargetWorkflowId || workflow?.id || lastCompleted?.id} />
    </section>

    {/* Stage details modal */}
    {detailsOpen && (
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Stage details" onClick={() => { setDetailsOpen(false); setDetailsStage(null) }}>
        <section className="settings-dialog workflow-modal" ref={detailsRef} onClick={event => event.stopPropagation()}>
          <div className="module-process-head">
            <span>Stage details</span>
            <b>{detailTarget?.label || 'Current stage'}</b>
          </div>
<p>{detailTarget?.description || currentDescription}</p>
          {(() => {
            const guide = (STAGE_GUIDES[moduleKey] || {})[detailTarget?.key]
            if (!guide) return null
            return (
              <div className="step-guide-card modal-guide">
                <div className="step-guide-head"><span>Current task</span><em>~{guide.time}</em></div>
                <h4>{guide.task}</h4>
                <p>{guide.action}</p>
                <ul className="step-guide-checklist">
                  {guide.checklist.map(item => <li key={item}>· {item}</li>)}
                </ul>
              </div>
            )
          })()}
          <div className="module-data">
            <article><small>Assigned roles</small><b>{detailTarget?.roles?.join(', ') || 'N/A'}</b></article>
            {workflow?.subject_name && <article><small>Subject</small><b>{workflow.subject_name}</b></article>}
          </div>
          <div className="module-actions">
            <button className="cancel-button" onClick={() => { setDetailsOpen(false); setDetailsStage(null) }}>Close</button>
            <button className="module-primary" onClick={() => { setDetailsOpen(false); setDetailsStage(null) }}>Got it</button>
          </div>
        </section>
      </div>
    )}

    {/* Confirmation dialog */}
    {confirmOpen && (
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Confirm action" onClick={() => setConfirmOpen(false)}>
        <section className="schedule-dialog workflow-modal" ref={confirmRef} onClick={event => event.stopPropagation()}>
          <div><h2>Confirm step completion</h2><p>This will complete the current step and advance the workflow to the next stage.</p></div>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="module-primary" disabled={saving} onClick={confirmAction}>{saving ? 'Completing...' : 'Confirm & complete'}</button>
          </div>
        </section>
      </div>
    )}

    {scheduleOpen && <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Schedule training" onClick={() => setScheduleOpen(false)}><section className="schedule-dialog" ref={scheduleRef} onClick={event => event.stopPropagation()}><div><h2>Schedule training</h2><p>Set session details after HR verifies enrollment.</p></div><label>Training date<input type="date" value={schedule.date} onChange={event => setSchedule({ ...schedule, date: event.target.value })} /></label><label>Start time<input type="time" value={schedule.time} onChange={event => setSchedule({ ...schedule, time: event.target.value })} /></label><label>Venue<input value={schedule.venue} onChange={event => setSchedule({ ...schedule, venue: event.target.value })} /></label><div className="module-actions"><button className="module-secondary" onClick={() => setScheduleOpen(false)}>Cancel</button><button className="module-primary" disabled={saving} onClick={saveSchedule}>{saving ? 'Saving...' : 'Confirm schedule'}</button></div></section></div>}

    {returnOpen && (
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Return step" onClick={() => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') }}>
        <section className="schedule-dialog workflow-modal" ref={returnRef} onClick={event => event.stopPropagation()}>
          <div><h2>Return step</h2><p>Send this workflow back to an earlier stage for revision. The assigned role will be notified.</p></div>
          <label>Return to stage
            <select value={returnTarget} onChange={event => setReturnTarget(event.target.value)}>
              <option value="">Select a stage...</option>
              {previousStageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Reason for returning
            <textarea value={returnNote} onChange={event => setReturnNote(event.target.value)} placeholder="Explain what needs to be revised." />
          </label>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => { setReturnOpen(false); setReturnTarget(''); setReturnNote('') }}>Cancel</button>
            <button className="module-primary" disabled={saving} onClick={returnWorkflow}>{saving ? 'Returning...' : 'Return workflow'}</button>
          </div>
        </section>
      </div>
    )}

{cancelOpen && (
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Cancel workflow" onClick={() => { setCancelOpen(false); setCancelReason('') }}>
        <section className="schedule-dialog workflow-modal" ref={cancelRef} onClick={event => event.stopPropagation()}>
          <div><h2>Cancel workflow</h2><p>This will cancel the entire workflow. The reason is recorded in the audit history.</p></div>
          <label>Reason for cancellation
            <textarea value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Explain why this workflow is being cancelled." />
          </label>
          <div className="module-actions">
            <button className="module-secondary" onClick={() => { setCancelOpen(false); setCancelReason('') }}>Back</button>
            <button className="module-primary cancel-confirm" disabled={saving} onClick={cancelWorkflow}>{saving ? 'Cancelling...' : 'Cancel workflow'}</button>
          </div>
        </section>
      </div>
    )}

{/* Completed workflow history modal — RBAC-aware detail view */}
    {completedView && (
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Completed workflow history" onClick={closeCompletedView}>
        <section className="settings-dialog workflow-modal" onClick={event => event.stopPropagation()}>
          <div className="module-process-head">
            <span>Completed workflow</span>
            <b>{completedView.title}</b>
          </div>
          <div className="module-data">
            {completedView.subject_name && <article><small>Subject</small><b>{completedView.subject_name}</b></article>}
            <article><small>Status</small><b>{completedView.status}</b></article>
            {completedView.completed_at && <article><small>Completed</small><b>{new Date(completedView.completed_at).toLocaleString()}</b></article>}
          </div>
          <WorkflowTimeline workflow={completedView} events={completedEvents} />
          <div className="module-actions">
            <button className="module-primary" onClick={closeCompletedView}>Close</button>
          </div>
        </section>
      </div>
    )}

    {/* New Workflow composer — pick a fresh employee, start a brand-new cycle */}
    {composerOpen && (
      <div className="schedule-backdrop" role="dialog" aria-modal="true" aria-label="Create new workflow" onClick={() => setComposerOpen(false)}>
        <section className="schedule-dialog workflow-modal composer-modal" onClick={event => event.stopPropagation()}>
<div className="composer-head">
            <div><h2>Create New {title}</h2><p>Choose the subject to evaluate, then start a fresh workflow cycle.</p></div>
          </div>

          <label className="composer-field">
            <span>Subject to evaluate</span>
            <input
              value={composerEmployee ? composerEmployee.full_name : (evaluatingSubject ? evaluatingSubject.full_name : composerQuery)}
              onFocus={event => (event.target.value = '')}
              onChange={event => { setComposerQuery(event.target.value); setComposerEmployee(null); const match = people.find(p => p.full_name.toLowerCase() === event.target.value.trim().toLowerCase()); setEvaluatingSubject(match || null) }}
              placeholder="Search & select subject to evaluate…"
              list="composer-subject-list"
            />
            <datalist id="composer-subject-list">
              {people.map(person => <option key={person.id} value={person.full_name}>{person.job_title} · {person.department}</option>)}
            </datalist>
          </label>

          <div className="composer-results">
            {people
              .filter(person => !composerDept || (person.department || '').toLowerCase() === composerDept.toLowerCase())
              .filter(person => !composerQuery || `${person.full_name} ${person.job_title} ${person.department}`.toLowerCase().includes(composerQuery.toLowerCase()))
              .slice(0, 8)
              .map(person => (
                <button
                  key={person.id}
                  type="button"
                  className={`composer-employee ${(composerEmployee?.id === person.id || evaluatingSubject?.id === person.id) ? 'selected' : ''}`}
onClick={() => { setComposerEmployee(person); setComposerQuery(person.full_name); setEvaluatingSubject(person) }}
                >
                  <span className="composer-avatar">{(person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()}</span>
                  <span className="composer-employee-copy">
                    <b>{person.full_name}</b>
                    <small>{person.job_title} · {person.department}</small>
                  </span>
                </button>
              ))}
            {people.length === 0 && <p className="composer-empty">No employees available.</p>}
          </div>

          {(composerEmployee || evaluatingSubject) && (
            <div className="composer-selected">
              <b>Starting workflow for:</b>
              <span>{(composerEmployee || evaluatingSubject).full_name} — {(composerEmployee || evaluatingSubject).job_title}</span>
            </div>
          )}

          <div className="module-actions">
            <button className="module-secondary" onClick={() => setComposerOpen(false)}>Cancel</button>
            <button className="module-primary" disabled={saving || !(composerEmployee || evaluatingSubject)} onClick={createFromComposer}>
              {saving ? 'Creating...' : 'Start Workflow'}
            </button>
          </div>
        </section>
      </div>
    )}
  </main>
}

