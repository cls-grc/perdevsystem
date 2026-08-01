import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchableSelector from './SearchableSelector'
import ModuleAIInsights from './ModuleAIInsights'
import { api } from '../lib/api'

const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').role
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

  const start = async () => {
    if (role !== 'employee' && !assigned) return setError(`Select a valid ${itemLabel.toLowerCase()} first.`)
    setSaving(true)
    try {
      await api.createWorkflow({
        module: moduleKey,
        title: `${title}: ${selected[0]}`,
        subjectEmployeeId: role === 'employee' ? undefined : assigned?.id,
        metadata: { selectedItem: selected[0], selectedItemStatus: selected[2], assignedEmployee: assigned?.full_name },
      })
      setNotice(`${roleAction || 'Workflow'} started and saved to the database.`)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
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
      {(extraHeaderAction || (!workflow && roleAction)) && <div className="module-heading-actions">
        {!workflow && roleAction && <button onClick={start} disabled={!canStart || saving}>{saving ? 'Starting...' : roleAction}</button>}
        {extraHeaderAction}
      </div>}
    </div>
    {notice && <div className="module-notice">✓ {notice}</div>}
    {error && <div className="module-notice">{error}</div>}
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
                  </div>
                </>
              ) : (
                <p>This workflow is currently assigned to another role. No action controls are available.</p>
              )}
            </>
          ) : canStart ? (
            <>
              <SearchableSelector label={itemIsEmployee ? 'Assign employee' : `Select ${itemLabel}`} options={itemOptions} value={{ value: selected[0], label: selected[0], description: selected[1] }} onChange={option => setSelected(items.find(item => item[0] === option.value) || items[0])} />
              {role !== 'employee' && !itemIsEmployee && subject && (
                <SearchableSelector label="Assign employee" options={personOptions} value={{ value: subject.id, label: subject.full_name, description: `${subject.job_title} - ${subject.department}` }} onChange={option => setSubject(people.find(person => person.id === option.value) || people[0])} />
              )}
              <button className="module-primary" disabled={saving} onClick={start}>{saving ? 'Starting...' : roleAction || 'Start workflow'}</button>
            </>
          ) : null}
          {workflows.length > 1 && (
            <label className="workflow-picker">View active workflow<select value={workflow?.id || ''} onChange={event => chooseWorkflow(event.target.value)}>{workflows.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
          )}
        </div>
      </section>
      <ModuleAIInsights module={moduleKey} stage={display} />
    </section>
    {detailsOpen && (
      <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => {
        setDetailsOpen(false)
        setDetailsStage(null)
      }}>
        <section className="settings-dialog workflow-modal" onClick={event => event.stopPropagation()}>
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
    {scheduleOpen && <div className="schedule-backdrop" role="dialog" aria-modal="true" onClick={() => setScheduleOpen(false)}><section className="schedule-dialog" onClick={event => event.stopPropagation()}><div><h2>Schedule training</h2><p>Set session details after HR verifies enrollment.</p></div><label>Training date<input type="date" value={schedule.date} onChange={event => setSchedule({ ...schedule, date: event.target.value })} /></label><label>Start time<input type="time" value={schedule.time} onChange={event => setSchedule({ ...schedule, time: event.target.value })} /></label><label>Venue<input value={schedule.venue} onChange={event => setSchedule({ ...schedule, venue: event.target.value })} /></label><div className="module-actions"><button className="module-secondary" onClick={() => setScheduleOpen(false)}>Cancel</button><button className="module-primary" disabled={saving} onClick={saveSchedule}>{saving ? 'Saving...' : 'Confirm schedule'}</button></div></section></div>}
  </main>
}
