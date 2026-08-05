import { useMemo, useState } from 'react'
import {
  KPI_LIBRARY, LEARNING_TEMPLATES, COMPETENCY_TEMPLATES, GOAL_TEMPLATES,
  QUICK_COMMENTS, INTELLIGENT_DEFAULTS, COMPETENCY_LEVELS, LEARNING_CATEGORIES,
  REVIEW_TYPES, RECOGNITION_CATEGORIES, TRAINING_CATEGORIES, SUCCESSION_READINESS,
} from '../workflowConfig'

// ---------------------------------------------------------------------------
// Reusable per-step business forms for the workflow engine. Each module's
// stepForms config (from workflowConfig.js) drives which fields/builders are
// rendered. Forms collect values and validate before the parent enables
// "Complete Step".
//
// UX focus: minimize typing. New field types (radiogroup, checkboxgroup,
// slider, chips, commentSuggestions) replace free-text inputs with clicks.
// Templates, searchable selectors, defaults and AI-generation dramatically
// reduce manual data entry (selection-first UX).
// ---------------------------------------------------------------------------

function CommentChips({ options, value = '', onInsert }) {
  const [used, setUsed] = useState([])
  const add = phrase => {
    if (used.includes(phrase)) return
    const next = value.trim() ? `${value.trim()}; ${phrase}` : phrase
    setUsed([...used, phrase])
    onInsert(next)
  }
  return (
    <div className="comment-chips">
      {options.map(phrase => (
        <button
          key={phrase}
          type="button"
          className={`comment-chip ${used.includes(phrase) ? 'used' : ''}`}
          onClick={() => add(phrase)}
          disabled={used.includes(phrase)}
        >
          + {phrase}
        </button>
      ))}
    </div>
  )
}

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
    case 'radiogroup':
      return (
        <div className="choice-group">
          {(field.options || []).map(opt => (
            <label key={opt} className={value === opt ? 'selected' : ''}>
              <input type="radio" name={field.name} checked={value === opt} onChange={() => set(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )
    case 'checkboxgroup':
      return (
        <div className="choice-group">
          {(field.options || []).map(opt => {
            const arr = Array.isArray(value) ? value : []
            const checked = arr.includes(opt)
            return (
              <label key={opt} className={checked ? 'selected' : ''}>
                <input type="checkbox" checked={checked} onChange={() => set(checked ? arr.filter(x => x !== opt) : [...arr, opt])} />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )
    case 'slider':
      return (
        <div className="slider-field">
          <input type="range" min={field.min ?? 0} max={field.max ?? 100} value={Number(value ?? 0)} onChange={e => set(Number(e.target.value))} />
          <b>{Number(value ?? 0)}%</b>
        </div>
      )
    case 'chips':
      return (
        <div className="choice-group chips-group">
          {(field.options || []).map(opt => {
            const arr = Array.isArray(value) ? value : []
            const selected = arr.includes(opt)
            return (
              <button key={opt} type="button" className={`chip ${selected ? 'selected' : ''}`} onClick={() => set(selected ? arr.filter(x => x !== opt) : [...arr, opt])}>
                {selected ? '✓ ' : '+ '}{opt}
              </button>
            )
          })}
        </div>
      )
case 'commentSuggestions':
      return <CommentChips options={field.options || []} value={value || ''} onInsert={set} />
    case 'template':
      return <TemplateSelect field={field} value={value || ''} onChange={set} />
    case 'aiGenerate':
      return <AIGenerateButton field={field} value={value || ''} onChange={set} />
    default:
      return <input type="text" value={value || ''} onChange={e => set(e.target.value)} placeholder={field.placeholder || ''} />
  }
}

// ------------------------ Selection-first helpers ---------------------------

// Generic searchable template/option picker. Clicking an option sets the value
// and, via onApply, auto-fills dependent fields (title, description, etc.).
function TemplateSelect({ field, value, onChange }) {
  const [query, setQuery] = useState('')
  const options = field.library || field.options || []
  const filtered = options.filter(o => String(o.title || o.name || o).toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="template-select">
      <div className="template-search">
        <span className="template-search-icon">🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={field.placeholder || 'Search templates…'} />
      </div>
      <div className="template-list">
        {filtered.map(o => {
          const label = o.title || o.name || (typeof o === 'string' ? o : '')
          const sub = o.category || o.description || ''
          return (
            <button key={label} type="button" className={`template-option ${value === label ? 'selected' : ''}`} onClick={() => { onChange(label); field.onApply?.(o) }}>
              <span className="template-option-label">{label}</span>
              {sub && <small className="template-option-sub">{sub}</small>}
            </button>
          )
        })}
        {filtered.length === 0 && <p className="template-empty">No templates found.</p>}
      </div>
    </div>
  )
}

// "Generate using AI" button that fills a textarea with a generated draft.
function AIGenerateButton({ field, value, onChange }) {
  const [busy, setBusy] = useState(false)
  const generate = async () => {
    setBusy(true)
    // Local, deterministic draft generator (no backend call) so the button
    // always works offline and never blocks completion.
    const seed = field.seed || field.label || field.name || 'this item'
    const draft = `Generated ${seed.toLowerCase()}: a clear, professional draft based on the selected context. Review and refine if needed.`
    setTimeout(() => { onChange(draft); setBusy(false) }, 400)
  }
  return (
    <div className="ai-generate-row">
      <button type="button" className="ai-generate-btn" onClick={generate} disabled={busy}>
        {busy ? 'Generating…' : '✨ Generate using AI'}
      </button>
      {value && <span className="ai-generate-hint">Draft generated — edit if needed.</span>}
    </div>
  )
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

// --------------------- Builder: KPI library (selection-first) --------------

function KpiLibraryBuilder({ value = [], onChange }) {
  const add = kpi => {
    if (!kpi || value.some(r => r.name === kpi.name)) return
    onChange([...value, { name: kpi.name, weight: kpi.weight, description: kpi.description, target: kpi.target, measurement: kpi.measurement }])
  }
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const remove = index => onChange(value.filter((_, i) => i !== index))
  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  return (
    <div className="builder competency-template-builder">
      <div className="kpi-picker-field">
        <label className="competency-picker-label">
          <span>Select a KPI to add</span>
          <select value="" onChange={e => {
            const kpi = KPI_LIBRARY.find(k => k.name === e.target.value)
            add(kpi)
            e.target.value = ''
          }}>
            <option value="">Choose a KPI…</option>
            {KPI_LIBRARY.map(k => (
              <option key={k.name} value={k.name} disabled={value.some(r => r.name === k.name)}>{k.name} ({k.weight}% · {k.measurement})</option>
            ))}
          </select>
          <small>Pick a KPI from the list to add it, then adjust its weight and target if needed.</small>
        </label>
      </div>
      {value.length > 0 && (
        <div className="competency-loaded">
          <div className="competency-loaded-head">
            <div>
              <b>Selected KPIs ({value.length})</b>
              <small>Adjust weight & target only if needed</small>
            </div>
            <span className={`weight-total ${totalWeight === 100 ? 'ok' : ''}`}>Total {totalWeight}%</span>
          </div>
          <div className="competency-table">
            {value.map((row, index) => (
              <div className="competency-table-row" key={index}>
                <div className="competency-table-name">
                  <input value={row.name} onChange={e => set(index, { name: e.target.value })} />
                </div>
                <div className="kpi-table-target">
                  <input value={row.target} onChange={e => set(index, { target: e.target.value })} placeholder="Target" />
                </div>
                <div className="competency-table-weight">
                  <input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value })} min={0} max={100} />
                  <i className="weight-bar"><em style={{ width: `${Math.min(100, Number(row.weight) || 0)}%` }} /></i>
                </div>
                <button type="button" className="builder-remove" onClick={() => remove(index)} aria-label="Remove KPI">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
const setQ = (index, patch) => {
    const updated = value.questions.map((q, i) => i === index ? { ...q, ...patch } : q)
    onChange({
      ...value,
      questions: updated,
      overall: Math.round((updated.reduce((s, q) => s + Number(q.rating || 0), 0) / Math.max(1, updated.length)) * 20),
    })
  }
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

// Extract a submitted assessment's overall score from the workflow event log.
// Each assessment stage stores { questions, overall } in details.formData.
function extractAssessmentScore(events, stageKey) {
  const event = (events || []).find(ev => ev.stage === stageKey && ev.details)
  const form = event?.details?.formData || event?.details || {}
  return Number(form.overall || form.overallScore || 0)
}

// Extract the full assessment (questions with ratings + comments) for quick view.
function extractAssessment(events, stageKey) {
  const event = (events || []).find(ev => ev.stage === stageKey && ev.details)
  const form = event?.details?.formData || event?.details || {}
  return Array.isArray(form.questions) ? form.questions : null
}

const CALIBRATION_DECISIONS = [
  'Accept Supervisor Score',
  'Use Average',
  'Override Final Score',
  'Return for Reassessment',
]

function CalibrationBuilder({ value = {}, onChange, events = [] }) {
  // Read-only scores auto-loaded from the completed assessment steps.
const employeeScore = extractAssessmentScore(events, 'self_assessment')
  const managerScore = extractAssessmentScore(events, 'performance_evaluation')
  const gap = employeeScore && managerScore ? Math.abs(managerScore - employeeScore) : 0
  const average = employeeScore && managerScore ? Math.round((employeeScore + managerScore) / 2) : 0
  const decision = value.decision || ''
  const showOverride = decision === 'Override Final Score'
  const requireReason = showOverride || decision === 'Return for Reassessment'
  // Only the visible fields are validated — decision always required, finalScore
  // only when overriding, reason only when overriding or returning.
  const dataComplete = Boolean(employeeScore && managerScore)
  const canComplete = Boolean(decision) &&
    (!showOverride || (value.finalScore !== '' && value.finalScore !== undefined && value.finalScore !== null)) &&
    (!requireReason || String(value.reason || '').trim().length > 0)

  const set = patch => onChange({ ...value, ...patch })

  // A single atomic onChange for the decision so the (stale) closure never
  // overwrites the newly chosen decision with the previous value.
  const handleDecision = nextDecision => {
    const next = { ...value, decision: nextDecision }
    if (nextDecision !== 'Override Final Score') next.finalScore = ''
    onChange(next)
  }

  const [viewAssessment, setViewAssessment] = useState(null)

const employeeAssessment = extractAssessment(events, 'self_assessment')
  const managerAssessment = extractAssessment(events, 'performance_evaluation')

  // TEMP DEBUG — remove after the disabled-button issue is resolved.
  // eslint-disable-next-line no-console
  console.log('[Calibration] events', events?.length, '| employeeScore', employeeScore, '| managerScore', managerScore, '| decision', decision, '| finalScore', value.finalScore, '| reason', value.reason, '| dataComplete', dataComplete, '| canComplete', canComplete)

  return (
    <div className="builder calibration-builder">
      {/* Read-only comparison cards — HR compares, never re-enters */}
      <div className="calibration-compare">
        <div className="calibration-score-card">
          <small>Employee Self Assessment</small>
          <b className="calibration-score">{employeeScore || '—'}</b>
          <em>Auto-loaded · read-only</em>
          <button type="button" className="calibration-view-btn" onClick={() => setViewAssessment('employee')} disabled={!employeeAssessment}>
            View employee assessment
          </button>
        </div>
        <div className={`calibration-score-card ${gap > 15 ? 'gap-high' : gap > 0 ? 'gap-moderate' : 'gap-zero'}`}>
          <small>Score Gap</small>
          <b className="calibration-gap">{employeeScore && managerScore ? gap : '—'}</b>
          <em>{gap > 15 ? 'Significant gap' : gap > 0 ? 'Minor gap' : employeeScore && managerScore ? 'No gap' : 'Awaiting scores'}</em>
        </div>
        <div className="calibration-score-card">
          <small>Supervisor Assessment</small>
          <b className="calibration-score">{managerScore || '—'}</b>
          <em>Auto-loaded · read-only</em>
          <button type="button" className="calibration-view-btn" onClick={() => setViewAssessment('manager')} disabled={!managerAssessment}>
            View supervisor assessment
          </button>
        </div>
      </div>

      {!dataComplete && (
        <p className="calibration-hint" role="alert">
          ⚠️ Calibration cannot begin because previous assessment data is incomplete. Both the employee and supervisor assessments must be submitted before calibrating.
        </p>
      )}

      {dataComplete && (
        <p className="calibration-hint">
          A gap of <b>{gap} points</b>{' '}
          {gap > 15 ? 'is significant — consider a calibration discussion or returning for reassessment.' : 'is within an acceptable calibration range.'}
          {' '}· Average of both scores is <b>{average}/100</b>.
        </p>
      )}

      {/* Only the decision + conditional final score / reason are required */}
      <label className="form-field">
        <span>Calibration Decision *</span>
        <select value={decision} onChange={e => handleDecision(e.target.value)}>
          <option value="">Select…</option>
          {CALIBRATION_DECISIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>

      {showOverride && (
        <label className="form-field">
          <span>Final Score *</span>
          <input type="number" value={value.finalScore ?? ''} min={0} max={100} onChange={e => set({ finalScore: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0–100" />
          <small className="field-hint">Override the calibrated final score for this employee.</small>
        </label>
      )}

      <label className="form-field">
        <span>Reason{requireReason ? ' *' : ''}</span>
        <textarea value={value.reason || ''} onChange={e => set({ reason: e.target.value })} rows={2} placeholder={requireReason ? 'Explain this calibration decision (required).' : 'Optional note explaining the calibration outcome.'} />
      </label>

      {/* Read-only modal of the selected assessment */}
      {viewAssessment && (
        <div className="calibration-modal-backdrop" onClick={() => setViewAssessment(null)}>
          <div className="calibration-modal" onClick={event => event.stopPropagation()}>
            <div className="calibration-modal-head">
              <h4>{viewAssessment === 'employee' ? 'Employee Self Assessment' : 'Supervisor Assessment'}</h4>
              <button type="button" className="calibration-modal-close" onClick={() => setViewAssessment(null)}>×</button>
            </div>
            {(viewAssessment === 'employee' ? employeeAssessment : managerAssessment)?.map((q, index) => (
              <div className="calibration-modal-item" key={index}>
                <div className="calibration-modal-q">
                  <span>{index + 1}. {q.question}</span>
                  <b>{q.rating || 0}/5</b>
                </div>
                {q.comment ? <p>{q.comment}</p> : <p className="calibration-modal-empty">No comment.</p>}
              </div>
            ))}
            <div className="module-actions">
              <button type="button" className="module-primary" onClick={() => setViewAssessment(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------- Builder: Competency template (selection-first) --------

function CompetencyTemplateBuilder({ value = [], onChange }) {
  const positions = Object.keys(COMPETENCY_TEMPLATES)
  const apply = pos => {
    if (!pos) { onChange([]); return }
    const rows = COMPETENCY_TEMPLATES[pos].map(r => ({ position: pos, competency: r.competency, level: r.level, weight: r.weight }))
    onChange(rows)
  }
  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const levelColor = lvl => ({ Foundation: '#8a8792', Developing: '#b06948', Proficient: '#5d49be', Expert: '#31965b' }[lvl] || '#5d49be')
  return (
    <div className="builder competency-template-builder">
      <div className="competency-picker-field">
        <label className="competency-picker-label">
          <span>Select a position template</span>
          <select value={value.length > 0 ? value[0].position : ''} onChange={e => apply(e.target.value)}>
            <option value="">Choose a position…</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos} ({COMPETENCY_TEMPLATES[pos].length} competencies)</option>
            ))}
          </select>
          <small>Pick a position to auto-load its required competencies, levels and weights.</small>
        </label>
      </div>
      {value.length > 0 && (
        <div className="competency-loaded">
          <div className="competency-loaded-head">
            <div>
              <b>{value[0].position}</b>
              <small>Template loaded — adjust levels & weights only if needed</small>
            </div>
            <span className={`weight-total ${totalWeight === 100 ? 'ok' : ''}`}>Total {totalWeight}%</span>
          </div>
          <div className="competency-table">
            {value.map((row, index) => (
              <div className="competency-table-row" key={index}>
                <div className="competency-table-name">
                  <input value={row.competency} onChange={e => {
                    const next = [...value]; next[index] = { ...row, competency: e.target.value }; onChange(next)
                  }} />
                </div>
                <div className="competency-table-level">
                  <select value={row.level} style={{ borderColor: levelColor(row.level) }} onChange={e => {
                    const next = [...value]; next[index] = { ...row, level: e.target.value }; onChange(next)
                  }}>
                    <option value="">Level…</option>
                    {COMPETENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="competency-table-weight">
                  <input type="number" value={row.weight} onChange={e => {
                    const next = [...value]; next[index] = { ...row, weight: e.target.value }; onChange(next)
                  }} min={0} max={100} />
                  <i className="weight-bar"><em style={{ width: `${Math.min(100, Number(row.weight) || 0)}%` }} /></i>
                </div>
                <button type="button" className="builder-remove" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label="Delete">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
  kpiLibrary: { Component: KpiLibraryBuilder, initial: () => [] },
  assessment: { Component: AssessmentBuilder, initial: role => ({ questions: DEFAULT_QUESTIONS.map(q => ({ question: q, rating: 0, comment: '' })), overall: 0, role: role || '' }) },
calibration: { Component: CalibrationBuilder, initial: () => ({ decision: '', finalScore: '', reason: '' }) },
  competencyTemplate: { Component: CompetencyTemplateBuilder, initial: () => [] },
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
    else if (field.type === 'slider') acc[field.name] = field.min ?? 0
    else if (field.type === 'multiSelect' || field.type === 'checkboxgroup' || field.type === 'chips') acc[field.name] = []
    else if (field.type === 'commentSuggestions') acc[field.name] = ''
    else acc[field.name] = ''
    return acc
  }, {})
}

export default function WorkflowForms({ formConfig, value, onChange, role, people, suggestions = [], events = [] }) {
  const [error, setError] = useState('')
  const [section, setSection] = useState(0)

  if (!formConfig) return null
  const builder = formConfig.builder ? BUILDERS[formConfig.builder] : null
  const fields = formConfig.fields || []
  const progressive = formConfig.progressive && !builder && fields.length > 0
  const visibleFields = progressive ? fields.filter(f => f.section === undefined || f.section === section) : fields

const isRequiredFilled = useMemo(() => {
    if (builder) {
      if (Array.isArray(value)) return value.length > 0
      if (formConfig.builder === 'calibration') {
        // Calibration requires a decision; finalScore when overriding; reason
        // when overriding or returning for reassessment.
        const decision = value?.decision || ''
        if (!decision) return false
        if (decision === 'Override Final Score' && (value?.finalScore === '' || value?.finalScore === undefined || value?.finalScore === null)) return false
        if ((decision === 'Override Final Score' || decision === 'Return for Reassessment') && !String(value?.reason || '').trim()) return false
        return true
      }
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
{progressive && (
        <div className="progressive-nav">
          {fields.filter((f, i, arr) => arr.findIndex(x => x.section === f.section) === i).map((f, i) => (
            <button key={f.name} type="button" className={`prog-dot ${i === section ? 'active' : ''}`} onClick={() => setSection(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
{builder ? (
        <builder.Component value={value} onChange={onChange} role={role} people={people || []} events={events} />
      ) : (
        visibleFields.map(field => (
          <div className="form-field-wrap" key={field.name}>
            <label className="form-field">
              <span>{field.label}{field.required ? ' *' : ''}</span>
              <Field field={field} value={value?.[field.name]} onChange={(name, v) => onChange({ ...value, [name]: v })} people={people || []} />
              {field.hint ? <small className="field-hint">{field.hint}</small> : null}
            </label>
            {field.type === 'textarea' && suggestions.length > 0 && (
              <div className="form-suggestions">
                <CommentChips options={suggestions} value={value?.[field.name] || ''} onInsert={v => onChange({ ...value, [field.name]: v })} />
              </div>
            )}
          </div>
        ))
      )}
      {progressive && section < fields.length - 1 && (
        <button type="button" className="prog-next" onClick={() => setSection(s => s + 1)}>Next section →</button>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <small className="form-status">{isRequiredFilled ? '✓ Ready to complete' : 'Complete required fields to continue'}</small>
      </div>
    </form>
  )
}

