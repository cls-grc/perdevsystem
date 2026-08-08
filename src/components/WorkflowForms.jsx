import { useEffect, useMemo, useState } from 'react'
import {
  KPI_LIBRARY, LEARNING_TEMPLATES, COMPETENCY_TEMPLATES, GOAL_TEMPLATES,
  QUICK_COMMENTS, INTELLIGENT_DEFAULTS, COMPETENCY_LEVELS, LEARNING_CATEGORIES,
  REVIEW_TYPES, RECOGNITION_CATEGORIES, TRAINING_CATEGORIES, SUCCESSION_READINESS,
  getRecommendedCoursesForGap,
} from '../workflowConfig'
import { api } from '../lib/api'

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

const DEFAULT_KPIS = [
  { name: 'Customer Service', target: '90%', weight: 25, description: 'Guest satisfaction and service quality standards' },
  { name: 'Attendance & Punctuality', target: '95%', weight: 20, description: 'Punctuality and attendance reliability' },
  { name: 'Teamwork & Collaboration', target: '90%', weight: 25, description: 'Collaboration and team support' },
  { name: 'Problem Solving', target: '85%', weight: 30, description: 'Initiative and problem resolution skills' },
]

function extractConfiguredKpis(events) {
  const event = (events || []).find(ev => ev.stage === 'configure_kpi' && ev.details)
  const form = event?.details?.formData || event?.details || {}
  if (Array.isArray(form) && form.length > 0) return form
  if (Array.isArray(form.kpis) && form.kpis.length > 0) return form.kpis
  return null
}

function extractKpiData(events, stageKey) {
  const event = (events || []).find(ev => ev.stage === stageKey && ev.details)
  const form = event?.details?.formData || event?.details || {}
  if (Array.isArray(form.kpiRatings) && form.kpiRatings.length > 0) {
    const overall = Number(form.overall || Math.round(form.kpiRatings.reduce((s, k) => s + Number(k.score || 0), 0) / Math.max(1, form.kpiRatings.length)))
    return { kpis: form.kpiRatings, overall }
  }
  if (Array.isArray(form.questions) && form.questions.length > 0) {
    const kpis = form.questions.map(q => ({
      name: q.question,
      score: Math.round((Number(q.rating || 0) / 5) * 100),
      comment: q.comment || ''
    }))
    const overall = Number(form.overall || Math.round(kpis.reduce((s, k) => s + k.score, 0) / Math.max(1, kpis.length)))
    return { kpis, overall }
  }
  return { kpis: [], overall: 0 }
}

function AssessmentBuilder({ value = {}, onChange, role, events = [] }) {
  const configuredKpis = useMemo(() => extractConfiguredKpis(events), [events])
  const empSelfData = useMemo(() => extractKpiData(events, 'self_assessment'), [events])

  const initialKpis = useMemo(() => {
    if (configuredKpis && configuredKpis.length > 0) {
      return configuredKpis.map(k => ({
        name: k.name || k.title,
        target: k.target || '90%',
        weight: k.weight || 25,
        description: k.description || '',
      }))
    }
    return DEFAULT_KPIS
  }, [configuredKpis])

  const kpis = value.kpiRatings || []

  // Ensure state initialization
  useEffect(() => {
    if (!value.kpiRatings || value.kpiRatings.length === 0) {
      const initialRatings = initialKpis.map(k => ({
        name: k.name,
        target: k.target,
        weight: k.weight,
        score: role === 'employee' ? 85 : 80,
        comment: '',
      }))
      const overall = Math.round(initialRatings.reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(1, initialRatings.length))
      onChange({ ...value, kpiRatings: initialRatings, overall })
    }
  }, [initialKpis])

  const updateKpiScore = (index, patch) => {
    const currentList = value.kpiRatings || initialKpis.map(k => ({ name: k.name, target: k.target, weight: k.weight, score: 80, comment: '' }))
    const updated = currentList.map((k, i) => i === index ? { ...k, ...patch } : k)
    const overall = Math.round(updated.reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(1, updated.length))
    onChange({ ...value, kpiRatings: updated, overall })
  }

  const isDeptHeadEval = role !== 'employee' && empSelfData.kpis.length > 0

  return (
    <div className="builder assessment-builder">
      <div className="builder-note">
        {role === 'employee' 
          ? 'Enter your self-assessment percentage score (0–100%) and comments for each KPI below.'
          : 'Department Head Independent Evaluation: Enter your own evaluation score and comments for each KPI.'}
      </div>

      <div className="kpi-assessment-list">
        {(kpis.length > 0 ? kpis : initialKpis).map((kpi, index) => {
          const empMatch = empSelfData.kpis.find(e => e.name === kpi.name) || empSelfData.kpis[index]
          return (
            <div className="kpi-assessment-card" key={index}>
              <div className="kpi-assessment-header">
                <div>
                  <h4 className="kpi-title">{kpi.name}</h4>
                  {kpi.target && <span className="kpi-target-tag">Target: {kpi.target}</span>}
                </div>
                <div className="kpi-score-badge">
                  <b>{kpi.score ?? 80}%</b>
                </div>
              </div>

              {isDeptHeadEval && empMatch && (
                <div className="emp-self-reference">
                  <span className="reference-label">Employee Self-Rating Reference:</span>
                  <span className="reference-score"><b>{empMatch.score}%</b></span>
                  {empMatch.comment && <p className="reference-comment">"{empMatch.comment}"</p>}
                </div>
              )}

              <div className="kpi-score-input-group">
                <label className="score-label">
                  <span>{role === 'employee' ? 'Self Score (%)' : 'Department Head Score (%)'}</span>
                  <div className="slider-with-number">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={kpi.score ?? 80} 
                      onChange={e => updateKpiScore(index, { score: Number(e.target.value) })}
                    />
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={kpi.score ?? 80} 
                      onChange={e => updateKpiScore(index, { score: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    />
                    <span>%</span>
                  </div>
                </label>
              </div>

              <div className="kpi-comment-input">
                <textarea 
                  value={kpi.comment || ''} 
                  onChange={e => updateKpiScore(index, { comment: e.target.value })} 
                  placeholder={role === 'employee' ? 'Add self-assessment supporting notes or achievements...' : 'Add supervisor evaluation notes and evidence...'}
                  rows={2}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="builder-score-summary">
        <span>Overall {role === 'employee' ? 'Self-Assessment' : 'Department Head'} Average:</span>
        <b className="overall-score-big">{value.overall || 0}%</b>
      </div>
    </div>
  )
}

// ------------------------- Builder: Calibration ----------------------------

function CalibrationBuilder({ value = {}, onChange, events = [] }) {
  const empData = extractKpiData(events, 'self_assessment')
  const deptData = extractKpiData(events, 'performance_evaluation')

  // Fallback data if events don't exist yet (e.g. testing calibration directly)
  const empKpis = empData.kpis.length > 0 ? empData.kpis : [
    { name: 'Customer Service', score: 90, comment: 'Exceeded customer satisfaction goal with positive guest reviews.' },
    { name: 'Attendance & Punctuality', score: 95, comment: 'Zero unexcused absences and consistent on-time shifts.' },
    { name: 'Teamwork & Collaboration', score: 85, comment: 'Supported cross-department initiatives during peak hours.' },
    { name: 'Problem Solving', score: 88, comment: 'Proactively handled guest inquiries and system glitches.' }
  ]

  const deptKpis = deptData.kpis.length > 0 ? deptData.kpis : [
    { name: 'Customer Service', score: 82, comment: 'Good service, but occasional delays reported during lunch rushes.' },
    { name: 'Attendance & Punctuality', score: 88, comment: 'Good attendance record overall, two minor late clock-ins.' },
    { name: 'Teamwork & Collaboration', score: 90, comment: 'Outstanding team spirit, always helps peers when busy.' },
    { name: 'Problem Solving', score: 80, comment: 'Solves standard issues well, needs guidance on complex escalations.' }
  ]

  const kpiComparisons = empKpis.map((empKpi, i) => {
    const deptMatch = deptKpis.find(d => d.name === empKpi.name) || deptKpis[i] || { score: 85, comment: '' }
    const empVal = Number(empKpi.score || 0)
    const deptVal = Number(deptMatch.score || 0)
    const diff = empVal - deptVal
    const absDiff = Math.abs(diff)
    return {
      name: empKpi.name,
      empScore: empVal,
      deptScore: deptVal,
      diff,
      absDiff,
      isDisagreement: absDiff >= 5,
      empComment: empKpi.comment || '',
      deptComment: deptMatch.comment || ''
    }
  })

  const overallEmpAvg = Math.round(kpiComparisons.reduce((s, k) => s + k.empScore, 0) / Math.max(1, kpiComparisons.length))
  const overallDeptAvg = Math.round(kpiComparisons.reduce((s, k) => s + k.deptScore, 0) / Math.max(1, kpiComparisons.length))
  const overallDiff = Math.round((overallEmpAvg - overallDeptAvg) * 10) / 10
  const absOverallDiff = Math.abs(overallDiff)

  const decision = value.decision || ''
  const isOverride = decision === 'Override Final Score' || decision === 'Override / Adjust Final Score'
  const isReturn = decision === 'Return for Revision' || decision === 'Return Evaluation for Revision'
  const requireReason = isOverride || isReturn

  const set = patch => onChange({ ...value, ...patch })

  const handleDecisionSelect = opt => {
    let calculatedFinal = ''
    if (opt.includes('Department Head') || opt.includes('Dept Head')) calculatedFinal = overallDeptAvg
    else if (opt.includes('Self-Assessment') || opt.includes('Employee')) calculatedFinal = overallEmpAvg
    else if (opt.includes('Average')) calculatedFinal = Math.round((overallEmpAvg + overallDeptAvg) / 2)
    else if (opt.includes('Override') || opt.includes('Adjust')) calculatedFinal = value.finalScore ?? overallDeptAvg
    else calculatedFinal = ''

    onChange({
      ...value,
      decision: opt,
      finalScore: calculatedFinal,
      employeeAvg: overallEmpAvg,
      deptAvg: overallDeptAvg,
      overallDiff
    })
  }

  const [expandedComments, setExpandedComments] = useState({})
  const toggleComments = index => {
    setExpandedComments(prev => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="builder calibration-builder">
      {/* Overview Score Cards */}
      <div className="calibration-summary-grid">
        <div className="calibration-card emp-card">
          <span className="card-tag">Employee Self-Assessment</span>
          <b className="card-score">{overallEmpAvg}%</b>
          <small className="card-sub">Overall Average</small>
        </div>

        <div className="calibration-card diff-card">
          <span className="card-tag">Score Difference</span>
          <b className={`card-diff ${overallDiff > 0 ? 'diff-pos' : overallDiff < 0 ? 'diff-neg' : ''}`}>
            {overallDiff > 0 ? `+${overallDiff}` : overallDiff}%
          </b>
          <small className="card-sub">
            {absOverallDiff >= 5 ? '⚠️ Significant Disagreement' : 'Within Normal Range'}
          </small>
        </div>

        <div className="calibration-card dept-card">
          <span className="card-tag">Department Head Evaluation</span>
          <b className="card-score">{overallDeptAvg}%</b>
          <small className="card-sub">Overall Average</small>
        </div>
      </div>

      {/* KPI Comparison Table */}
      <div className="calibration-section">
        <div className="section-head">
          <h4>KPI Score Comparison & Disagreement Breakdown</h4>
          <span className="section-hint">High discrepancy items (≥5% gap) are flagged for HR calibration review</span>
        </div>

        <div className="calibration-table-wrap">
          <table className="calibration-table">
            <thead>
              <tr>
                <th>KPI / Metric</th>
                <th className="text-center">Employee Self</th>
                <th className="text-center">Dept Head</th>
                <th className="text-center">Difference</th>
                <th>Status & Comments</th>
              </tr>
            </thead>
            <tbody>
              {kpiComparisons.map((item, index) => (
                <tr key={index} className={item.isDisagreement ? 'row-disagreement' : ''}>
                  <td className="kpi-cell">
                    <strong>{item.name}</strong>
                  </td>
                  <td className="text-center score-emp">
                    <span>{item.empScore}%</span>
                  </td>
                  <td className="text-center score-dept">
                    <span>{item.deptScore}%</span>
                  </td>
                  <td className="text-center">
                    <span className={`diff-pill ${item.diff > 0 ? 'pill-plus' : item.diff < 0 ? 'pill-minus' : 'pill-zero'}`}>
                      {item.diff > 0 ? `+${item.diff}` : item.diff} pts
                    </span>
                  </td>
                  <td>
                    <div className="status-notes-cell">
                      {item.isDisagreement ? (
                        <span className="disagreement-badge">⚠️ {item.absDiff} pts Disagreement</span>
                      ) : (
                        <span className="aligned-badge">✓ Aligned</span>
                      )}
                      
                      {(item.empComment || item.deptComment) && (
                        <button 
                          type="button" 
                          className="toggle-comments-btn"
                          onClick={() => toggleComments(index)}
                        >
                          {expandedComments[index] ? 'Hide Comments' : 'View Notes'}
                        </button>
                      )}
                    </div>
                    
                    {expandedComments[index] && (
                      <div className="comments-expand-box">
                        {item.empComment && (
                          <div className="comment-block emp-comment">
                            <small>Employee Comment:</small>
                            <p>"{item.empComment}"</p>
                          </div>
                        )}
                        {item.deptComment && (
                          <div className="comment-block dept-comment">
                            <small>Department Head Comment:</small>
                            <p>"{item.deptComment}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HR Calibration Decision Controls */}
      <div className="calibration-section decision-section">
        <h4>HR Calibration Decision</h4>
        <p className="field-hint">Select the final resolution for this employee's performance evaluation score:</p>

        <div className="decision-options-grid">
          {[
            { id: 'Accept Department Head Score', label: 'Accept Dept Head Score', sub: `${overallDeptAvg}% final score` },
            { id: 'Accept Employee Self-Assessment', label: 'Accept Employee Self-Assessment', sub: `${overallEmpAvg}% final score` },
            { id: 'Use Average of Scores', label: 'Use Average Score', sub: `${Math.round((overallEmpAvg + overallDeptAvg)/2)}% final score` },
            { id: 'Override Final Score', label: 'Adjust / Override Final Score', sub: 'Custom calibrated score' },
            { id: 'Return for Revision', label: 'Return Evaluation for Revision', sub: 'Send back to Dept Head' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`decision-option-card ${decision === opt.id ? 'active' : ''}`}
              onClick={() => handleDecisionSelect(opt.id)}
            >
              <div className="radio-circle">{decision === opt.id ? '●' : '○'}</div>
              <div className="option-text">
                <strong className="option-title">{opt.label}</strong>
                <small className="option-sub">{opt.sub}</small>
              </div>
            </button>
          ))}
        </div>

        {/* Final Calibrated Score Display / Input */}
        {decision && !isReturn && (
          <div className="final-score-box">
            <label className="form-field">
              <span>Final Calibrated Score (%) *</span>
              <input
                type="number"
                min="0"
                max="100"
                value={value.finalScore ?? ''}
                disabled={!isOverride}
                onChange={e => set({ finalScore: e.target.value === '' ? '' : Number(e.target.value) })}
                className="final-score-input"
              />
              <small className="field-hint">
                {isOverride ? 'Enter custom calibrated percentage score.' : 'Automatically computed based on your calibration decision.'}
              </small>
            </label>
          </div>
        )}

        {/* Calibration Notes */}
        <label className="form-field calibration-notes-field">
          <span>Calibration Notes & Justification{requireReason ? ' *' : ''}</span>
          <textarea
            value={value.reason || ''}
            onChange={e => set({ reason: e.target.value })}
            rows={3}
            placeholder={requireReason ? 'Explain the calibration decision or revision request (required).' : 'Add notes regarding HR calibration discussion, score adjustments, or justification.'}
          />
        </label>
      </div>
    </div>
  )
}

// ------------------- Builder: Skill Gap & Learning Plan -------------------

function SkillGapPlanBuilder({ value = {}, onChange, people = [], subject }) {
  const [selectedCompetency, setSelectedCompetency] = useState('')
  // Per-competency map of { [competencyName]: courseTitle } for assigned courses
  // so the badge persists correctly when switching between gap cards.
  const [assignedMap, setAssignedMap] = useState({})
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [gaps, setGaps] = useState([])
  const [loadingGaps, setLoadingGaps] = useState(false)

  const subjectEmp = subject || (people.length > 0 ? people[0] : null)
  const employeeId = subjectEmp?.id || subjectEmp?.employee_id
  const subjectName = subjectEmp?.full_name || 'Employee'

  // Load (or reload) REAL skill gaps from the database for the selected subject.
  const loadGaps = async (cancelled = { current: false }) => {
    if (!employeeId) return
    setLoadingGaps(true)
    setError('')
    try {
      const result = await api.learningSkillGaps({ employeeId })
      if (cancelled.current) return
      const list = result.gaps || []
      setGaps(list)
      // Default-select the first gap if none selected yet, or keep current
      // selection if it's still present in the new list.
      setSelectedCompetency(prev =>
        list.some(g => g.competency === prev) ? prev : (list[0]?.competency || '')
      )
    } catch (err) {
      if (!cancelled.current) setError(err.message || 'Could not load skill gaps.')
    } finally {
      if (!cancelled.current) setLoadingGaps(false)
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    void loadGaps(cancelled)
    return () => { cancelled.current = true }
  }, [employeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recommended courses: prefer real library courses already tagged with the
  // competency (attached by the server), then fall back to the curated
  // competency→learning template map.
  const recommendedCourses = useMemo(() => {
    const gap = gaps.find(g => g.competency === selectedCompetency)
    if (gap?.courses?.length) return gap.courses
    return getRecommendedCoursesForGap(selectedCompetency, gap?.score || 0)
  }, [gaps, selectedCompetency])

  const handleAssignCourse = async (course) => {
    if (!employeeId) {
      setError('Please select or assign an employee first.')
      return
    }
    setAssigning(true)
    setError('')
    try {
      await api.assignLearningGap({
        subjectEmployeeId: employeeId,
        courseTitle: course.title,
        competencyName: selectedCompetency,
        gapScore: gaps.find(g => g.competency === selectedCompetency)?.gap || 0,
      })
      // Persist the assignment badge per competency so it survives tab switches.
      setAssignedMap(prev => ({ ...prev, [selectedCompetency]: course.title }))
      setNotice(`Learning path "${course.title}" assigned to ${subjectName} to close the ${selectedCompetency} gap.`)
      onChange({
        ...value,
        planTitle: value.planTitle || `Dev Plan: ${selectedCompetency}`,
        assignedCourse: course.title,
        prioritySkills: Array.isArray(value.prioritySkills)
          ? [...new Set([...value.prioritySkills, selectedCompetency])]
          : [selectedCompetency],
        assignedFromCompetencyGap: true,
        competencyName: selectedCompetency,
      })
      // Reload gaps — the server may have created a new library resource which
      // will now appear in the courses list for this competency.
      await loadGaps()
    } catch (err) {
      setError(err.message || 'Could not assign course.')
    } finally {
      setAssigning(false)
    }
  }

  // Clear transient notices when the user switches to a different gap.
  const handleSelectCompetency = (comp) => {
    setSelectedCompetency(comp)
    setNotice('')
    setError('')
  }

  const set = patch => onChange({ ...value, ...patch })

  return (
    <div className="builder skill-gap-builder">
      {/* Skill Gaps Overview */}
      <div className="skill-gaps-section">
        <div className="section-head">
          <h4>Detected Skill Gaps for {subjectName}</h4>
          <span className="section-hint">Click a skill gap to view recommended learning courses</span>
        </div>

        {loadingGaps ? (
          <p className="empty-hint">Loading skill gaps…</p>
        ) : gaps.length === 0 ? (
          <p className="empty-hint">No skill gaps detected for this employee. All competencies meet their required level.</p>
        ) : (
          <div className="gap-cards-grid">
            {gaps.map(g => (
              <button
                key={g.competency}
                type="button"
                className={`gap-card ${selectedCompetency === g.competency ? 'active' : ''}${assignedMap[g.competency] ? ' assigned' : ''}`}
                onClick={() => handleSelectCompetency(g.competency)}
              >
                <div className="gap-card-head">
                  <span className="gap-competency">{g.competency}</span>
                  {assignedMap[g.competency]
                    ? <span className="gap-pill assigned-pill">✓ Course assigned</span>
                    : <span className="gap-pill">-{g.gap}% gap</span>
                  }
                </div>
                <div className="gap-score-bar">
                  <div className="score-fill" style={{ width: `${g.score}%` }} />
                </div>
                <div className="gap-card-foot">
                  <small>Current: {g.score}%</small>
                  <small>Target: {g.required_score}%</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Learning Courses */}
      {selectedCompetency && (
        <div className="recommended-learning-section">
          <h4>Recommended Courses for "{selectedCompetency}"</h4>
          <p className="field-hint">Select a course to auto-create and assign a Learning Path workflow for {subjectName}:</p>

          {notice && <div className="assigned-success-notice">{notice}</div>}
          {error && <p className="form-error">{error}</p>}

          <div className="recommended-courses-grid">
            {recommendedCourses.map(course => (
              <div className="recommended-course-card" key={course.title}>
                <div className="course-card-head">
                  <span className="course-category-tag">{course.category}</span>
                  <span className="course-duration">⏱ {course.duration_hours || course.duration || '-'} hrs</span>
                </div>
                <h5 className="course-title">{course.title}</h5>
                <p className="course-desc">{course.description}</p>
                {course.objectives && <small className="course-objectives"><b>Objectives:</b> {course.objectives}</small>}

                <button
                  type="button"
                  className="assign-course-btn"
                  disabled={assigning || assignedMap[selectedCompetency] === course.title}
                  onClick={() => handleAssignCourse(course)}
                >
                  {assignedMap[selectedCompetency] === course.title
                    ? '✓ Learning Path Assigned'
                    : assigning ? 'Assigning…' : '⚡ Assign Learning Path'}
                </button>
              </div>
            ))}
            {recommendedCourses.length === 0 && <p className="empty-hint">No recommended courses found for this competency.</p>}
          </div>
        </div>
      )}

      {/* Optional Plan Notes */}
      <div className="plan-notes-section">
        <label className="form-field">
          <span>Development Plan Notes</span>
          <textarea
            value={value.coachingNotes || ''}
            onChange={e => set({ coachingNotes: e.target.value })}
            rows={2}
            placeholder="Add coaching objectives or specific targets for this development plan..."
          />
        </label>
      </div>
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
  assessment: { Component: AssessmentBuilder, initial: role => ({ kpiRatings: DEFAULT_KPIS.map(k => ({ name: k.name, target: k.target, weight: k.weight, score: role === 'employee' ? 85 : 80, comment: '' })), overall: 82, role: role || '' }) },
calibration: { Component: CalibrationBuilder, initial: () => ({ decision: '', finalScore: '', reason: '' }) },
  competencyTemplate: { Component: CompetencyTemplateBuilder, initial: () => [] },
  skillGapPlan: { Component: SkillGapPlanBuilder, initial: () => ({ planTitle: 'Development Plan', prioritySkills: ['Customer Service'], coachingNotes: '' }) },
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

export default function WorkflowForms({ formConfig, value, onChange, role, people, suggestions = [], events = [], subject }) {
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
        <builder.Component value={value} onChange={onChange} role={role} people={people || []} events={events} subject={subject} />
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

