import { useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Reusable per-step business forms for the workflow engine. Each module's
// stepForms config (from workflowConfig.js) drives which fields/builders are
// rendered. Forms collect values and validate before the parent enables
// "Complete Step".
// ---------------------------------------------------------------------------

function Field({ field, value, onChange, people = [] }) {
  const set = next => onChange(field.name, next)
  switch (field.type) {
    case 'text':
      return <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} />
    case 'textarea':
      return <textarea value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} rows={field.rows || 3} />
    case 'number':
      return <input type="number" value={value ?? ''} min={field.min ?? 0} max={field.max ?? 100} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder={field.placeholder || ''} />
    case 'date':
      return <input type="date" value={value || ''} onChange={e => set(e.target.value)} />
    case 'time':
      return <input type="time" value={value || ''} onChange={e => set(e.target.value)} />
    case 'money':
      return <input type="number" value={value ?? ''} min={0} step="0.01" onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
    case 'select':
      return (
        <select value={value || ''} onChange={e => set(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )
    case 'employee':
      return (
        <select value={value || ''} onChange={e => set(e.target.value)}>
          <option value="">Select…</option>
          {field.options ? field.options.map(opt => <option key={opt} value={opt}>{opt}</option>) : people.map(p => <option key={p.id} value={p.full_name}>{p.full_name} — {p.department}</option>)}
        </select>
      )
    case 'rating':
      return (
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} type="button" className={Number(value) >= r ? 'on' : ''} onClick={() => set(r)} aria-label={`${r} star${r > 1 ? 's' : ''}`}>
              ★
            </button>
          ))}
        </div>
      )
    case 'toggle':
      return (
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(value)} onChange={e => set(e.target.checked)} />
          <span>{field.label || field.name}</span>
        </label>
      )
    case 'fileHint':
      return (
        <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.hint || 'Paste a link or describe the evidence'} />
      )
    case 'link':
      return <input type="url" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || 'https://…'} />
    default:
      return <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} />
  }
}

// ------------------------- Builder: KPI table ------------------------------

function KpiBuilder({ value = [], onChange }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { name: '', weight: '', description: '', target: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder kpi-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>KPI name<input value={row.name} onChange={e => set(index, { name: e.target.value })} placeholder="e.g. Guest satisfaction" /></label>
            <label>Weight %<input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value })} min={0} max={100} /></label>
            <label>Target value<input value={row.target} onChange={e => set(index, { target: e.target.value })} placeholder="e.g. 95" /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete KPI">×</button>
          </div>
          <label>Description<textarea value={row.description} onChange={e => set(index, { description: e.target.value })} rows={2} placeholder="Describe what this KPI measures" /></label>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Add KPI</button>
    </div>
  )
}

// ------------------------- Builder: Assessment -----------------------------

const DEFAULT_QUESTIONS = [
  'Delivered consistent results against KPI targets.',
  'Demonstrated the required core competencies.',
  'Showed ownership, initiative and problem-solving.',
  'Collaborated effectively across the team.',
  'Aligned behavior with organizational values.',
]

function AssessmentBuilder({ value = {}, onChange, role }) {
  const questions = value.questions || []
  const ensure = () => {
    if (questions.length !== DEFAULT_QUESTIONS.length) {
      const filled = DEFAULT_QUESTIONS.map((q, i) => ({ question: q, rating: questions[i]?.rating || 0, comment: questions[i]?.comment || '' }))
      onChange({ ...value, questions: filled })
    }
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [touched] = useState(false)
  if (!touched) ensure()
  const setQ = (index, patch) => onChange({
    ...value,
    questions: value.questions.map((q, i) => i === index ? { ...q, ...patch } : q),
    overall: Math.round((value.questions.reduce((s, q) => s + Number(q.rating || 0), 0) / Math.max(1, value.questions.length)) * 20),
  })
  return (
    <div className="builder assessment-builder">
      <div className="builder-note">This is the {role === 'employee' ? 'self' : 'manager'} assessment. Rate each item below.</div>
      {value.questions && value.questions.map((q, index) => (
        <div className="assessment-item" key={index}>
          <p>{q.question}</p>
          <div className="rating-row">
            {[1, 2, 3, 4, 5].map(r => (
              <button key={r} type="button" className={Number(q.rating) >= r ? 'on' : ''} onClick={() => setQ(index, { rating: r })} aria-label={`${r} star${r > 1 ? 's' : ''}`}>★</button>
            ))}
          </div>
          <textarea value={q.comment || ''} onChange={e => setQ(index, { comment: e.target.value })} placeholder="Add a comment / supporting evidence" rows={2} />
        </div>
      ))}
      {value.overall ? <div className="builder-score">Overall score: <b>{value.overall}/100</b></div> : null}
    </div>
  )
}

// ------------------------- Builder: Calibration ----------------------------

function CalibrationBuilder({ value = {}, onChange }) {
  const employeeScore = Number(value.employeeScore || value.selfScore || 0)
  const managerScore = Number(value.managerScore || value.supervisorScore || 0)
  const gap = employeeScore && managerScore ? Math.abs(managerScore - employeeScore) : 0
  const set = patch => onChange({ ...value, ...patch })
  return (
    <div className="builder calibration-builder">
      <div className="calibration-compare">
        <div><small>Employee self score</small><input type="number" value={value.employeeScore || ''} min={0} max={100} onChange={e => set({ employeeScore: e.target.value }) } /></div>
        <div><small>Supervisor score</small><input type="number" value={value.managerScore || ''} min={0} max={100} onChange={e => set({ managerScore: e.target.value }) } /></div>
        <div className="calibration-gap"><small>Score gap</small><b>{gap}</b></div>
      </div>
      {gap > 0 && <p className="calibration-hint">A gap of <b>{gap} points</b> {gap > 15 ? 'is significant — consider a calibration discussion.' : 'is within an acceptable calibration range.'}</p>}
      <label>Calibration decision<select value={value.decision || ''} onChange={e => set({ decision: e.target.value })}><option value="">Select…</option><option>Approve</option><option>Reject</option><option>Return for review</option></select></label>
      <label>Calibration notes<textarea value={value.notes || ''} onChange={e => set({ notes: e.target.value })} rows={2} placeholder="Explain the calibration outcome" /></label>
    </div>
  )
}

// ------------------- Builder: Competency requirement -----------------------

function CompetencyRequirementBuilder({ value = [], onChange }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { position: '', competency: '', level: '', weight: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder requirement-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>Position<input value={row.position} onChange={e => set(index, { position: e.target.value })} placeholder="e.g. Front Office Supervisor" /></label>
            <label>Competency<input value={row.competency} onChange={e => set(index, { competency: e.target.value })} placeholder="e.g. Customer Service" /></label>
            <label>Required level<select value={row.level} onChange={e => set(index, { level: e.target.value })}><option value="">Level…</option><option>Foundation</option><option>Developing</option><option>Proficient</option><option>Expert</option></select></label>
            <label>Weight %<input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value })} min={0} max={100} /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete">×</button>
          </div>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Add requirement</button>
    </div>
  )
}

// ------------------------- Builder: Resources ------------------------------

function ResourcesBuilder({ value = [], onChange }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { type: 'link', name: '', url: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder resources-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>Type<select value={row.type} onChange={e => set(index, { type: e.target.value })}><option>PDF</option><option>Video</option><option>Link</option><option>Document</option></select></label>
            <label>Name<input value={row.name} onChange={e => set(index, { name: e.target.value })} placeholder="e.g. HACCP Guide" /></label>
            <label>URL / Note<input value={row.url} onChange={e => set(index, { url: e.target.value })} placeholder="https://… or note" /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete">×</button>
          </div>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Add resource</button>
    </div>
  )
}

// ------------------------- Builder: Assign employees -----------------------

function AssignEmployeesBuilder({ value = [], onChange, people = [] }) {
  const toggle = name => onChange(value.includes(name) ? value.filter(n => n !== name) : [...value, name])
  return (
    <div className="builder assign-builder">
      <div className="builder-note">Select employees to assign.</div>
      <div className="assign-list">
        {people.map(p => (
          <label key={p.id} className={value.includes(p.full_name) ? 'selected' : ''}>
            <input type="checkbox" checked={value.includes(p.full_name)} onChange={() => toggle(p.full_name)} />
            <span>{p.full_name} — {p.department}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ------------------------- Builder: Progress tracker -----------------------

function ProgressBuilder({ value = [], onChange }) {
  return (
    <div className="builder progress-builder">
      <div className="builder-note">Current progress for the assigned learners.</div>
      {value.map((row, index) => (
        <div className="progress-row" key={index}>
          <span>{row.name || `Learner ${index + 1}`}</span>
          <div className="progress-track"><i style={{ width: `${row.progress || 0}%` }} /></div>
          <b>{row.progress || 0}%</b>
          <input type="number" value={row.progress || 0} min={0} max={100} onChange={e => {
            const next = [...value]; next[index] = { ...row, progress: Number(e.target.value) }; onChange(next)
          }} />
        </div>
      ))}
      {!value.length && <p className="empty-hint">No learners assigned yet — assign employees first.</p>}
      {value.length > 0 && <button type="button" className="builder-add" onClick={() => onChange([...value, { name: '', progress: 0 }])}>+ Add learner</button>}
    </div>
  )
}

// ------------------------- Builder: Attendance -----------------------------

function AttendanceBuilder({ value = [], onChange }) {
  const toggle = (index, present) => {
    const next = [...value]
    next[index] = { ...next[index], present }
    onChange(next)
  }
  return (
    <div className="builder attendance-builder">
      <div className="builder-note">Record which participants attended.</div>
      {value.map((row, index) => (
        <div className="attendance-row" key={index}>
          <span>{row.name || `Participant ${index + 1}`}</span>
          <div className="attendance-controls">
            <button type="button" className={row.present ? 'active' : ''} onClick={() => toggle(index, true)}>Present</button>
            <button type="button" className={row.present === false ? 'absent' : ''} onClick={() => toggle(index, false)}>Absent</button>
          </div>
        </div>
      ))}
      {!value.length && <p className="empty-hint">Invite participants first to record attendance.</p>}
    </div>
  )
}

// ------------------------- Builder: Talent pool ----------------------------

function TalentPoolBuilder({ value = [], onChange }) {
  // value = array of {name, role, readiness} selections
  const toggle = index => onChange(value.map((p, i) => i === index ? { ...p, selected: !p.selected } : p))
  return (
    <div className="builder talent-builder">
      <div className="builder-note">Select candidates for the critical position.</div>
      {value.map((p, index) => (
        <label key={index} className={p.selected ? 'selected' : ''}>
          <input type="checkbox" checked={Boolean(p.selected)} onChange={() => toggle(index)} />
          <span>{p.name} — {p.role || ''}</span>
          {p.readiness ? <em>{p.readiness}</em> : null}
        </label>
      ))}
      {!value.length && <p className="empty-hint">No talent pool records yet.</p>}
    </div>
  )
}

// ------------------------- Builder: Nomination -----------------------------

function NominationsBuilder({ value = [], onChange, people = [] }) {
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const add = () => onChange([...value, { employee: '', rationale: '', targetRole: '' }])
  const remove = index => onChange(value.filter((_, i) => i !== index))
  return (
    <div className="builder nominees-builder">
      {value.map((row, index) => (
        <div className="builder-row" key={index}>
          <div className="builder-grid">
            <label>Candidate<select value={row.employee} onChange={e => set(index, { employee: e.target.value })}><option value="">Select…</option>{people.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}</select></label>
            <label>Target role<input value={row.targetRole} onChange={e => set(index, { targetRole: e.target.value })} placeholder="e.g. Department Head" /></label>
            <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Delete">×</button>
          </div>
          <label>Rationale<textarea value={row.rationale} onChange={e => set(index, { rationale: e.target.value })} rows={2} placeholder="Why this candidate?" /></label>
        </div>
      ))}
      <button type="button" className="builder-add" onClick={add}>+ Nominate candidate</button>
    </div>
  )
}

// ------------------------------- Form shell --------------------------------

const BUILDERS = {
  kpi: { Component: KpiBuilder, initial: () => [] },
  assessment: { Component: AssessmentBuilder, initial: role => ({ questions: DEFAULT_QUESTIONS.map(q => ({ question: q, rating: 0, comment: '' })), overall: 0, role: role || '' }) },
  calibration: { Component: CalibrationBuilder, initial: () => ({ employeeScore: '', managerScore: '', decision: '', notes: '' }) },
  competencyRequirement: { Component: CompetencyRequirementBuilder, initial: () => [] },
  resources: { Component: ResourcesBuilder, initial: () => [] },
  assignEmployees: { Component: AssignEmployeesBuilder, initial: () => [] },
  progress: { Component: ProgressBuilder, initial: () => [] },
  attendance: { Component: AttendanceBuilder, initial: () => [] },
  talentPool: { Component: TalentPoolBuilder, initial: () => [] },
  nominations: { Component: NominationsBuilder, initial: () => [] },
}

// Returns a fresh initial value for a step's form/builder so the workflow UI
// can seed the controlled form value when a stage becomes current. Returns
// undefined for plain field-only forms (their value starts as {}).
export function getInitialValue(formConfig, role) {
  if (!formConfig) return undefined
  if (formConfig.builder) {
    const builder = BUILDERS[formConfig.builder]
    return builder ? builder.initial(role) : {}
  }
  const fields = formConfig.fields || []
  if (fields.length === 0) return undefined
  return fields.reduce((acc, field) => {
    if (field.type === 'toggle') acc[field.name] = false
    else if (field.type === 'rating') acc[field.name] = 0
    else if (field.type === 'multiSelect') acc[field.name] = []
    else acc[field.name] = ''
    return acc
  }, {})
}

export default function WorkflowForms({ formConfig, value, onChange, role, people }) {
  const [error, setError] = useState('')

  if (!formConfig) return null
  const builder = formConfig.builder ? BUILDERS[formConfig.builder] : null

  const isRequiredFilled = useMemo(() => {
    if (builder) {
      if (Array.isArray(value)) return value.length > 0
      return Boolean(value && Object.keys(value).length)
    }
    return (formConfig.fields || []).every(field => {
      if (!field.required) return true
      const v = value?.[field.name]
      if (Array.isArray(v)) return v.length > 0
      if (field.type === 'toggle') return Boolean(v)
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
  }, [builder, value, formConfig])

  const onSubmit = e => {
    e.preventDefault()
    if (!isRequiredFilled) {
      setError('Please complete all required fields before completing this step.')
      return
    }
    setError('')
    onChange(value, { submit: true })
  }

  return (
    <form className="workflow-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <h3>{formConfig.title}</h3>
        <p>{formConfig.description}</p>
      </div>
      {builder ? (
        <builder.Component value={value} onChange={onChange} role={role} people={people || []} />
      ) : (
        (formConfig.fields || []).map(field => (
          <label className="form-field" key={field.name}>
            <span>{field.label}{field.required ? ' *' : ''}</span>
            <Field field={field} value={value?.[field.name]} onChange={(name, v) => onChange({ ...value, [name]: v })} people={people || []} />
            {field.hint ? <small className="field-hint">{field.hint}</small> : null}
          </label>
        ))
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <small className="form-status">{isRequiredFilled ? '✓ Ready to complete' : 'Complete required fields to continue'}</small>
      </div>
    </form>
  )
}

