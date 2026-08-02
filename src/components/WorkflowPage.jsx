import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchableSelector from './SearchableSelector'
import ModuleAIInsights from './ModuleAIInsights'
import useDialogFocus from '../hooks/useDialogFocus'
import { api } from '../lib/api'

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
  const moduleKey = module || moduleKeys[title]
  const [workflow, setWorkflow] = useState(null)
  const [workflows, setWorkflows] = useState([])
  const [definitions, setDefinitions] = useState([])
  const [events, setEvents] = useState([])
  const [people, setPeople] = useState([])
  const [subject, setSubject] = useState(null)
  const [selected, setSelected] = useState(items[0] || ['', '', ''])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsStage, setDetailsStage] = useState(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [workflowFilter, setWorkflowFilter] = useState('')
  const [schedule, setSchedule] = useState({ date: '', time: '09:00', venue: 'Hotel Learning Hub' })

  const roleAction = typeof action === 'string' ? action : action?.[role]
  const itemOptions = useMemo(
    () => items.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [items],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, definitionResult, subjectResult] = await Promise.all([
        api.workflows(moduleKey),
        api.workflowDefinitions(),
        api.workflowSubjects(),
      ])
      const active = list.workflows[0] || null
      setWorkflows(list.workflows || [])
      setDefinitions(definitionResult.workflows[moduleKey] || [])
      setPeople(subjectResult.employees || [])
      setSubject(previous => previous || subjectResult.employees?.[0] || null)
      setWorkflow(active)
      setEvents(active ? (await api.workflow(active.id)).events || [] : [])
      setError('')
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
  const roleStages = useMemo(
    () => normalizedStages.filter(stage => stage.roles.includes(role)),
    [normalizedStages, role],
  )
  const canStart = Boolean(normalizedStages[0]?.roles.includes(role))
  const canAct = Boolean(workflow && current?.roles.includes(role))
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

  // Live items: when the page uses employees as items, prefer real records from the API.
  const liveItems = useMemo(() => {
    if (!itemIsEmployee || !people.length) return items
    return people.map(person => [person.full_name, `${person.job_title} - ${person.department}`, 'Active', (person.full_name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()])
  }, [itemIsEmployee, people, items])

  const liveItemOptions = useMemo(
    () => liveItems.map(item => ({ value: item[0], label: item[0], description: item[1] })),
    [liveItems],
  )

  // Filter the workflow picker list by title/subject.
  const filteredWorkflows = useMemo(() => {
    if (!workflowFilter.trim()) return workflows
    const q = workflowFilter.toLowerCase()
    return workflows.filter(w => `${w.title} ${w.subject_name || ''}`.toLowerCase().includes(q))
  }, [workflows, workflowFilter])

  const start = async (trainingSchedule) => {
    if (role !== 'employee' && !assigned) return setError(`Select a valid ${itemLabel.toLowerCase()} first.`)
    setNotice(`Creating ${title.toLowerCase()} workflow...`)
    setError('')
    setSaving(true)
    try {
      const result = await api.createWorkflow({
        module: moduleKey,
        title: `${title}: ${selected[0]}`,
        subjectEmployeeId: role === 'employee' ? undefined : assigned?.id,
        metadata: {
          selectedItem: selected[0],
          selectedItemStatus: selected[2],
          assignedEmployee: assigned?.full_name,
          ...(trainingSchedule ? { trainingSchedule } : {}),
        },
      })
      if (trainingSchedule) {
        await api.addWorkflowNote(result.workflow.id, {
          note: `Training scheduled: ${trainingSchedule.date} at ${trainingSchedule.time}, ${trainingSchedule.venue}.`,
          data: { type: 'training_schedule', ...trainingSchedule, training: selected[0] },
        })
      }
      setNotice(trainingSchedule ? 'Training schedule and workflow saved to the database.' : `${roleAction || 'Workflow'} started and saved to the database.`)
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

  const openAssignedAction = () => {
    setError('')
    const assignedWorkflow = workflows.find(entry => {
      const stage = normalizedStages.find(candidate => candidate.key === entry.current_stage)
      return stage?.roles.includes(role)
    })

    if (!assignedWorkflow) {
      setNotice(`There are no ${title.toLowerCase()} actions waiting for your role.`)
      return
    }

    void chooseWorkflow(assignedWorkflow.id)
    setNotice(`${roleAction} is ready in the selected workflow.`)
  }

  const handleHeaderAction = () => {
    if (canStart) {
      begin()
      return
    }
    openAssignedAction()
  }

  const complete = async () => {
    setSaving(true)
    try {
      const result = await api.advanceWorkflow(workflow.id, {
        note: note || undefined,
        data: { selectedItem: selected[0] },
      })
      setNote('')
      setNotice(
        result.completed
          ? 'Workflow completed and recorded.'
          : `${display} completed. ${result.nextAction} is now awaiting its assigned role.`,
      )
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    if (!note.trim()) return setError('Add a note before saving.')
    setSaving(true)
    try {
      await api.addWorkflowNote(workflow.id, { note, data: { selectedItem: selected[0] } })
      setNote('')
      setNotice('Note saved to the database audit history.')
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
      setNotice(`Workflow returned to "${result.returnedTo}" for the assigned role to redo.`)
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
      setNotice('Workflow cancelled and recorded in the audit history.')
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
      setNotice('Verified training schedule saved to the database.')
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

  if (loading) return <main className="module-workspace"><div className="dashboard-skeleton"><i /><i /><i /><i /></div></main>

  const personOptions = people.map(person => ({ value: person.id, label: person.full_name, description: `${person.job_title} - ${person.department}` }))
  const stats = [
    ['Active workflows', workflows.length],
    ['Current stage', workflow ? display : 'Not started'],
    ['Audit entries', events.length],
    ['Last updated', workflow ? new Date(workflow.updated_at).toLocaleTimeString() : '-'],
  ]

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
    {notice && <div className="module-notice">✓ {notice}</div>}
    {error && <div className="module-error" role="alert"><span>{error}</span><button onClick={() => { setError(''); void load() }}>Retry</button></div>}
    <section className="module-metrics">
      {stats.map(([label, value], index) => <article key={label}><span>{index + 1}</span><div><small>{label}</small><b>{value}</b><em>Live database value</em></div></article>)}
    </section>
    <section className="module-grid">
      <section className="module-process">
        <div className="module-process-head">
          <span>{workflow ? (canAct ? 'Action required' : 'Read-only status') : 'Ready to start'}</span>
          <b>{display}</b>
        </div>
        <div className="module-steps">
          {roleStages.map((stage, index) => {
            const status = workflow
              ? index < roleCurrentIndex
                ? 'complete'
                : index === roleCurrentIndex
                ? 'active'
                : 'pending'
              : index === 0 && canStart
              ? 'active'
              : 'pending'
            return (
              <div
                key={stage.key}
                className={`module-step ${status}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDetailsStage(stage)
                  setDetailsOpen(true)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setDetailsStage(stage)
                    setDetailsOpen(true)
                  }
                }}
              >
                <div className="step-marker">{status === 'complete' ? '✓' : index + 1}</div>
                <div className="step-copy"><b>{stage.label}</b><small>{status === 'active' ? 'Current step' : status === 'complete' ? 'Completed' : 'Upcoming'}</small></div>
              </div>
            )
          })}
        </div>
        <div className="module-content">
          <h2>{display}</h2>
          <p>{workflow ? currentDescription : canStart ? 'Select a record, then start the workflow.' : 'Your role does not have a start action for this workflow.'}</p>
          {workflow && (
            <div className="module-actions module-details-row">
              <button className="module-secondary" type="button" onClick={() => {
                setDetailsStage(current)
                setDetailsOpen(true)
              }}>
                View current step details
              </button>
            </div>
          )}
          {workflow ? (
            <>
              <div className="module-content-meta">
                <p><strong>Assigned roles:</strong> {current?.roles?.join(', ') || 'N/A'}</p>
                <p><strong>Workflow item:</strong> {selected?.[0] || assigned?.full_name || 'Not selected'}</p>
              </div>
              {canAct ? (
                <>
                  <label>
                    Add note
                    <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add a note or review comment for this step." />
                  </label>
                  <div className="module-actions">
                    <button className="module-primary" disabled={saving} onClick={complete}>{saving ? 'Completing...' : 'Complete step'}</button>
                    <button className="module-secondary" disabled={saving || !note.trim()} onClick={saveNote}>Save note</button>
                    {canReturn && <button className="module-secondary return-button" disabled={saving} onClick={() => setReturnOpen(true)}>Return step</button>}
                  </div>
                </>
              ) : (
                <p>This workflow is currently assigned to another role. No action controls are available.</p>
              )}
              {canCancel && (
                <div className="module-actions module-cancel-row">
                  <button className="module-secondary cancel-button" disabled={saving} onClick={() => setCancelOpen(true)}>Cancel workflow</button>
                </div>
              )}
            </>
          ) : canStart ? (
            <>
              <SearchableSelector label={itemIsEmployee ? 'Assign employee' : `Select ${itemLabel}`} options={liveItemOptions.length ? liveItemOptions : itemOptions} value={{ value: selected[0], label: selected[0], description: selected[1] }} onChange={option => setSelected(liveItems.find(item => item[0] === option.value) || items.find(item => item[0] === option.value) || items[0])} />
              {role !== 'employee' && !itemIsEmployee && subject && (
                <SearchableSelector label="Assign employee" options={personOptions} value={{ value: subject.id, label: subject.full_name, description: `${subject.job_title} - ${subject.department}` }} onChange={option => setSubject(people.find(person => person.id === option.value) || people[0])} />
              )}
              <button className="module-primary" type="button" disabled={saving} onClick={begin}>{saving ? 'Creating...' : roleAction || 'Start workflow'}</button>
            </>
          ) : null}
          {filteredWorkflows.length > 0 && (
            <div className="workflow-picker-wrap">
              <label className="workflow-picker-label">View active workflow</label>
              <div className="workflow-picker-controls">
                <input
                  className="workflow-picker-search"
                  value={workflowFilter}
                  onChange={event => setWorkflowFilter(event.target.value)}
                  placeholder="Filter by title or employee…"
                  aria-label="Filter active workflows"
                />
                <select className="workflow-picker" value={workflow?.id || ''} onChange={event => chooseWorkflow(event.target.value)} aria-label="Select active workflow">
                  {filteredWorkflows.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </section>
      <ModuleAIInsights module={moduleKey} stage={display} />
    </section>
    {detailsOpen && (
      <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Stage details" onClick={() => {
        setDetailsOpen(false)
        setDetailsStage(null)
      }}>
        <section className="settings-dialog workflow-modal" ref={detailsRef} onClick={event => event.stopPropagation()}>
          <div className="module-process-head">
            <span>Stage details</span>
            <b>{detailTarget?.label || 'Current stage'}</b>
          </div>
          <p>{detailTarget?.description || currentDescription}</p>
          <div className="module-data">
            <article><small>Assigned roles</small><b>{detailTarget?.roles?.join(', ') || 'N/A'}</b></article>
            <article><small>Workflow item</small><b>{selected?.[0] || assigned?.full_name || 'Not selected'}</b></article>
          </div>
          <div className="module-actions">
            <button className="cancel-button" onClick={() => {
              setDetailsOpen(false)
              setDetailsStage(null)
            }}>Close</button>
            <button className="module-primary" onClick={() => {
              setDetailsOpen(false)
              setDetailsStage(null)
            }}>Got it</button>
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
  </main>
}

