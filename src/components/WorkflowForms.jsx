import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, Check, Search, Sparkles, CheckCircle, AlertTriangle, Clock, Zap, MapPin, Calendar, Users } from 'lucide-react'
import {
  KPI_LIBRARY, LEARNING_TEMPLATES, COMPETENCY_TEMPLATES, GOAL_TEMPLATES,
  QUICK_COMMENTS, INTELLIGENT_DEFAULTS, COMPETENCY_LEVELS, LEARNING_CATEGORIES,
  REVIEW_TYPES, RECOGNITION_CATEGORIES, TRAINING_CATEGORIES, SUCCESSION_READINESS,
  getRecommendedCoursesForGap,
} from '../workflowConfig'
import { api } from '../lib/api'
import SkillRadarChart, { LEVEL_SCORES } from './SkillRadarChart'

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
              <Star size={16} fill={Number(value) >= r ? 'currentColor' : 'none'} />
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
                {selected ? <Check size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <span style={{ marginRight: 3 }}>+</span>}{opt}
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
        <span className="template-search-icon"><Search size={14} /></span>
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
        {busy ? 'Generating…' : <><Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Generate using AI</>}
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

function parseNumericTarget(target, defaultVal = 100) {
  if (typeof target === 'number' && Number.isFinite(target) && target > 0) return target
  if (typeof target === 'string') {
    const matched = target.match(/(\d+(\.\d+)?)/)
    if (matched) {
      const num = parseFloat(matched[1])
      if (num > 0) return num
    }
  }
  return defaultVal
}

function calculateKpiContribution(score, target, weight) {
  const s = Number(score) || 0
  const t = parseNumericTarget(target, 100)
  const w = Number(weight) || 0
  const achievement = t > 0 ? s / t : s / 100
  const contribution = achievement * w
  return Math.round(contribution * 100) / 100
}

function KpiLibraryBuilder({ value = [], onChange }) {
  const add = kpi => {
    if (!kpi || value.some(r => r.name === kpi.name)) return
    onChange([...value, { name: kpi.name, weight: kpi.weight, description: kpi.description, target: kpi.target, measurement: kpi.measurement }])
  }
  const set = (index, patch) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  const remove = index => onChange(value.filter((_, i) => i !== index))
  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const isWeightValid = Math.abs(totalWeight - 100) <= 0.01

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
            {['All', 'Food & Beverage', 'Kitchen', 'Housekeeping', 'Front Office'].map(dept => {
              const deptKpis = KPI_LIBRARY.filter(k => (k.department || 'All') === dept)
              if (!deptKpis.length) return null
              return (
                <optgroup key={dept} label={dept === 'All' ? 'General (All Departments)' : dept}>
                  {deptKpis.map(k => (
                    <option key={k.name} value={k.name} disabled={value.some(r => r.name === k.name)}>
                      {k.name} · {k.measurement}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <small>Pick a KPI from the list (grouped by department) to add it, then adjust its weight and target if needed.</small>
        </label>
      </div>
      {value.length > 0 && (
        <div className="competency-loaded">
          <div className="competency-loaded-head">
            <div>
              <b>Configured KPIs ({value.length})</b>
              <small>Total weight must equal exactly 100% to proceed</small>
            </div>
            <span className={`weight-total ${isWeightValid ? 'ok' : 'error'}`}>
              {isWeightValid ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Total 100%</> : `Total ${totalWeight}% (Must be 100%)`}
            </span>
          </div>
          <div className="competency-table">
            {value.map((row, index) => (
              <div className="competency-table-row" key={index}>
                <div className="competency-table-name">
                  <label><small>KPI Name</small>
                    <input value={row.name} onChange={e => set(index, { name: e.target.value })} placeholder="KPI name" />
                  </label>
                </div>
                <div className="kpi-table-target">
                  <label><small>Target Score</small>
                    <input value={row.target} onChange={e => set(index, { target: e.target.value })} placeholder="e.g. 90" />
                  </label>
                </div>
                <div className="competency-table-weight">
                  <label><small>Weight (%)</small>
                    <input type="number" value={row.weight} onChange={e => set(index, { weight: e.target.value === '' ? '' : Number(e.target.value) })} min={0} max={100} />
                  </label>
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
  { name: 'Customer Service', target: '90', weight: 25, description: 'Guest satisfaction and service quality standards' },
  { name: 'Attendance & Punctuality', target: '95', weight: 20, description: 'Punctuality and attendance reliability' },
  { name: 'Teamwork & Collaboration', target: '90', weight: 25, description: 'Collaboration and team support' },
  { name: 'Problem Solving', target: '85', weight: 30, description: 'Initiative and problem resolution skills' },
]

function extractConfiguredKpis(events) {
  const event = (events || []).find(ev => ev.stage === 'configure_kpi' && ev.details)
  if (!event) return null
  const details = event.details || {}
  const form = details.formData !== undefined ? details.formData : details
  if (Array.isArray(form) && form.length > 0) return form
  if (Array.isArray(form.kpis) && form.kpis.length > 0) return form.kpis
  const numericValues = Object.keys(form)
    .filter(k => /^\d+$/.test(k))
    .map(k => form[k])
    .filter(k => k && (k.name || k.title))
  if (numericValues.length > 0) return numericValues
  return null
}

function calculateWeightedKpiAverage(kpis = []) {
  const rows = (kpis || [])
    .map(kpi => ({
      score: Number(kpi?.score),
      weight: Number(kpi?.weight) || 0,
      target: kpi?.target
    }))
    .filter(kpi => Number.isFinite(kpi.score))
  if (!rows.length) return 0
  const totalWeight = rows.reduce((sum, kpi) => sum + (kpi.weight > 0 ? kpi.weight : 0), 0)
  if (totalWeight > 0) {
    const totalWeightedScore = rows.reduce((sum, kpi) => {
      const contribution = calculateKpiContribution(kpi.score, kpi.target, kpi.weight)
      return sum + contribution
    }, 0)
    const normalized = (totalWeightedScore / totalWeight) * 100
    return Math.min(100, Math.max(0, Math.round(normalized * 100) / 100))
  }
  return Math.round(rows.reduce((sum, kpi) => sum + kpi.score, 0) / rows.length)
}

function extractKpiData(events, stageKey) {
  const event = (events || []).find(ev => ev.stage === stageKey && ev.details)
  const form = event?.details?.formData || event?.details || {}
  if (Array.isArray(form.kpiRatings) && form.kpiRatings.length > 0) {
    const overall = calculateWeightedKpiAverage(form.kpiRatings)
    return { kpis: form.kpiRatings, overall }
  }
  if (Array.isArray(form.questions) && form.questions.length > 0) {
    const kpis = form.questions.map(q => ({
      name: q.question,
      score: Math.round((Number(q.rating || 0) / 5) * 100),
      comment: q.comment || ''
    }))
    const overall = calculateWeightedKpiAverage(kpis)
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
        target: k.target || '90',
        weight: Number(k.weight) || 25,
        description: k.description || '',
      }))
    }
    return DEFAULT_KPIS
  }, [configuredKpis])

  const kpis = value.kpiRatings || []

  // Ensure state initialization
  useEffect(() => {
    if (!value.kpiRatings || value.kpiRatings.length === 0) {
      const initialRatings = initialKpis.map(k => {
        const empMatch = empSelfData.kpis.find(e => e.name === k.name)
        const defaultScore = role === 'employee' ? 85 : (empMatch ? empMatch.score : 80)
        const contribution = calculateKpiContribution(defaultScore, k.target, k.weight)
        return {
          name: k.name,
          target: k.target,
          weight: k.weight,
          score: defaultScore,
          contribution,
          comment: '',
        }
      })
      const overall = calculateWeightedKpiAverage(initialRatings)
      onChange({ ...value, kpiRatings: initialRatings, overall })
    }
  }, [initialKpis])

  const updateKpiScore = (index, patch) => {
    const currentList = value.kpiRatings || initialKpis.map(k => ({ name: k.name, target: k.target, weight: k.weight, score: 80, contribution: 0, comment: '' }))
    const updated = currentList.map((k, i) => {
      if (i !== index) return k
      const merged = { ...k, ...patch }
      merged.contribution = calculateKpiContribution(merged.score, merged.target, merged.weight)
      return merged
    })
    const overall = calculateWeightedKpiAverage(updated)
    onChange({ ...value, kpiRatings: updated, overall })
  }

  const isSupervisorEval = role !== 'employee' && empSelfData.kpis.length > 0

  return (
    <div className="builder assessment-builder">
      <div className="builder-note">
        {role === 'employee' 
          ? 'Enter your self-assessment score (0–100%) and comments for each configured KPI. Your weighted contribution is calculated automatically.'
          : 'Department Head / Supervisor Evaluation: Enter your independent evaluation score and comments for each configured KPI.'}
      </div>

      <div className="kpi-assessment-list">
        {(kpis.length > 0 ? kpis : initialKpis).map((kpi, index) => {
          const empMatch = empSelfData.kpis.find(e => e.name === kpi.name) || empSelfData.kpis[index]
          const currentScore = kpi.score ?? 80
          const currentContrib = calculateKpiContribution(currentScore, kpi.target, kpi.weight)
          const empScore = empMatch ? empMatch.score : null
          const empContrib = empScore !== null ? calculateKpiContribution(empScore, kpi.target, kpi.weight) : null

          return (
            <div className="kpi-assessment-card" key={index}>
              <div className="kpi-assessment-header">
                <div>
                  <h4 className="kpi-title">{kpi.name}</h4>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {kpi.target && <span className="kpi-target-tag">Target: {kpi.target}</span>}
                    <span className="kpi-target-tag" style={{ background: 'var(--bg-subtle, #f3f4f6)' }}>Weight: {kpi.weight}%</span>
                    <span className="kpi-target-tag" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                      Contribution: {currentContrib}%
                    </span>
                  </div>
                </div>
                <div className="kpi-score-badge">
                  <b>{currentScore}%</b>
                </div>
              </div>

              {isSupervisorEval && empMatch && (
                <div className="emp-self-reference" style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, marginTop: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="reference-label" style={{ fontWeight: 600, fontSize: 12 }}>Employee Self-Assessment:</span>
                    <span className="reference-score">
                      <b>{empScore}%</b> <small style={{ color: '#64748b' }}>({empContrib}% contribution)</small>
                    </span>
                  </div>
                  {empMatch.comment && <p className="reference-comment" style={{ margin: '4px 0 0 0', fontSize: 12, fontStyle: 'italic', color: '#475569' }}>"{empMatch.comment}"</p>}
                </div>
              )}

              <div className="kpi-score-input-group" style={{ marginTop: 12 }}>
                <label className="score-label">
                  <span>{role === 'employee' ? 'Self Score (%)' : 'Supervisor Score (%)'}</span>
                  <div className="slider-with-number">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={currentScore} 
                      onChange={e => updateKpiScore(index, { score: Number(e.target.value) })}
                    />
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={currentScore} 
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

      <div className="builder-score-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-card, #f8fafc)', borderRadius: 10, marginTop: 16, border: '1px solid var(--border-color, #e2e8f0)' }}>
        <span>Total Weighted {role === 'employee' ? 'Self-Assessment' : 'Supervisor Evaluation'} Score:</span>
        <b className="overall-score-big" style={{ fontSize: 22, color: 'var(--primary-color, #4f46e5)' }}>{value.overall || 0}%</b>
      </div>
    </div>
  )
}

// ------------------------- Builder: Calibration ----------------------------

function CalibrationBuilder({ value = {}, onChange, events = [] }) {
  const configuredKpis = extractConfiguredKpis(events) || []
  const empData = extractKpiData(events, 'self_assessment')
  const deptData = extractKpiData(events, 'performance_evaluation')

  // Fallback data if events don't exist yet
  const baseKpis = configuredKpis.length > 0 ? configuredKpis : (empData.kpis.length > 0 ? empData.kpis : DEFAULT_KPIS)

  const kpiComparisons = baseKpis.map((kpi, i) => {
    const empMatch = empData.kpis.find(d => d.name === (kpi.name || kpi.title)) || empData.kpis[i] || { score: 85, comment: '' }
    const deptMatch = deptData.kpis.find(d => d.name === (kpi.name || kpi.title)) || deptData.kpis[i] || { score: 80, comment: '' }
    
    const target = kpi.target || '90'
    const weight = Number(kpi.weight) || 25
    const empVal = Number(empMatch.score || 0)
    const deptVal = Number(deptMatch.score || 0)
    const empContrib = calculateKpiContribution(empVal, target, weight)
    const deptContrib = calculateKpiContribution(deptVal, target, weight)
    const diff = empVal - deptVal
    const contribDiff = Math.round((empContrib - deptContrib) * 100) / 100
    const absDiff = Math.abs(diff)

    return {
      name: kpi.name || kpi.title,
      target,
      weight,
      empScore: empVal,
      deptScore: deptVal,
      empContrib,
      deptContrib,
      diff,
      contribDiff,
      absDiff,
      isDisagreement: absDiff >= 5,
      empComment: empMatch.comment || '',
      deptComment: deptMatch.comment || ''
    }
  })

  const overallEmpAvg = calculateWeightedKpiAverage(kpiComparisons.map(kpi => ({ score: kpi.empScore, weight: kpi.weight, target: kpi.target })))
  const overallDeptAvg = calculateWeightedKpiAverage(kpiComparisons.map(kpi => ({ score: kpi.deptScore, weight: kpi.weight, target: kpi.target })))
  const overallDiff = Math.round((overallEmpAvg - overallDeptAvg) * 100) / 100
  const absOverallDiff = Math.abs(overallDiff)

  const decision = value.decision || ''
  const isOverride = decision === 'Override Final Score' || decision === 'Override / Adjust Final Score'
  const isReturn = decision === 'Return for Revision' || decision === 'Return Evaluation for Revision'
  const requireReason = isOverride || isReturn

  const set = patch => onChange({ ...value, ...patch })

  const handleDecisionSelect = opt => {
    let calculatedFinal = ''
    if (opt.includes('Department Head') || opt.includes('Dept Head') || opt.includes('Supervisor')) calculatedFinal = overallDeptAvg
    else if (opt.includes('Self-Assessment') || opt.includes('Employee')) calculatedFinal = overallEmpAvg
    else if (opt.includes('Average')) calculatedFinal = Math.round(((overallEmpAvg + overallDeptAvg) / 2) * 100) / 100
    else if (opt.includes('Override') || opt.includes('Adjust')) calculatedFinal = value.finalScore ?? overallDeptAvg
    else calculatedFinal = ''

    onChange({
      ...value,
      decision: opt,
      finalScore: calculatedFinal,
      employeeAvg: overallEmpAvg,
      deptAvg: overallDeptAvg,
      overallDiff,
      kpiComparisons
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
          <small className="card-sub">Weighted Total Score</small>
        </div>

        <div className="calibration-card diff-card">
          <span className="card-tag">Score Difference</span>
          <b className={`card-diff ${overallDiff > 0 ? 'diff-pos' : overallDiff < 0 ? 'diff-neg' : ''}`}>
            {overallDiff > 0 ? `+${overallDiff}` : overallDiff}%
          </b>
          <small className="card-sub">
            {absOverallDiff >= 5 ? <><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Significant Disagreement</> : 'Within Normal Range'}
          </small>
        </div>

        <div className="calibration-card dept-card">
          <span className="card-tag">Supervisor Evaluation</span>
          <b className="card-score">{overallDeptAvg}%</b>
          <small className="card-sub">Weighted Total Score</small>
        </div>
      </div>

      {/* KPI Comparison Table */}
      <div className="calibration-section">
        <div className="section-head">
          <h4>KPI Score & Contribution Comparison</h4>
          <span className="section-hint">Review both scores and weighted contributions before final calibration</span>
        </div>

        <div className="calibration-table-wrap">
          <table className="calibration-table">
            <thead>
              <tr>
                <th>KPI / Target / Weight</th>
                <th className="text-center">Employee Self</th>
                <th className="text-center">Supervisor</th>
                <th className="text-center">Difference</th>
                <th>Status & Notes</th>
              </tr>
            </thead>
            <tbody>
              {kpiComparisons.map((item, index) => (
                <tr key={index} className={item.isDisagreement ? 'row-disagreement' : ''}>
                  <td className="kpi-cell">
                    <strong>{item.name}</strong>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Target: {item.target} · Weight: {item.weight}%
                    </div>
                  </td>
                  <td className="text-center score-emp">
                    <div><b>{item.empScore}%</b></div>
                    <small style={{ color: '#64748b', fontSize: 10 }}>({item.empContrib}% contrib)</small>
                  </td>
                  <td className="text-center score-dept">
                    <div><b>{item.deptScore}%</b></div>
                    <small style={{ color: '#64748b', fontSize: 10 }}>({item.deptContrib}% contrib)</small>
                  </td>
                  <td className="text-center">
                    <span className={`diff-pill ${item.diff > 0 ? 'pill-plus' : item.diff < 0 ? 'pill-minus' : 'pill-zero'}`}>
                      {item.diff > 0 ? `+${item.diff}` : item.diff} pts
                    </span>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      {item.contribDiff > 0 ? `+${item.contribDiff}` : item.contribDiff}% contrib
                    </div>
                  </td>
                  <td>
                    <div className="status-notes-cell">
                      {item.isDisagreement ? (
                        <span className="disagreement-badge"><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> {item.absDiff} pts Disagreement</span>
                      ) : (
                        <span className="aligned-badge"><CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Aligned</span>
                      )}
                      
                      {(item.empComment || item.deptComment) && (
                        <button 
                          type="button" 
                          className="toggle-comments-btn"
                          onClick={() => toggleComments(index)}
                        >
                          {expandedComments[index] ? 'Hide Notes' : 'View Notes'}
                        </button>
                      )}
                    </div>
                    
                    {expandedComments[index] && (
                      <div className="comments-expand-box">
                        {item.empComment && (
                          <div className="comment-block emp-comment">
                            <small>Employee Self Note:</small>
                            <p>"{item.empComment}"</p>
                          </div>
                        )}
                        {item.deptComment && (
                          <div className="comment-block dept-comment">
                            <small>Supervisor Note:</small>
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
            { id: 'Accept Department Head Score', label: 'Accept Supervisor Evaluation', sub: `${overallDeptAvg}% weighted final score` },
            { id: 'Accept Employee Self-Assessment', label: 'Accept Employee Self-Assessment', sub: `${overallEmpAvg}% weighted final score` },
            { id: 'Use Average of Scores', label: 'Use Average Score', sub: `${Math.round(((overallEmpAvg + overallDeptAvg)/2) * 100) / 100}% final score` },
            { id: 'Override Final Score', label: 'Adjust / Override Final Score', sub: 'Custom calibrated score' },
            { id: 'Return for Revision', label: 'Return Evaluation for Revision', sub: 'Send back to Supervisor' }
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
              <span>Final Calibrated Performance Score (%) *</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={value.finalScore ?? ''}
                disabled={!isOverride}
                onChange={e => set({ finalScore: e.target.value === '' ? '' : Number(e.target.value) })}
                className="final-score-input"
              />
              <small className="field-hint">
                {isOverride ? 'Enter custom calibrated percentage score.' : 'Authoritative score that will update the employee record in real time upon workflow completion.'}
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

function SkillGapPlanBuilder({ value, onChange, role, people = [], subject }) {
  // Guard: value may arrive as undefined before formData is seeded
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  const [selectedCompetency, setSelectedCompetency] = useState('')
  // Per-competency map of { [competencyName]: courseTitle } for assigned courses
  const [assignedMap, setAssignedMap] = useState({})
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [gaps, setGaps] = useState([])
  const [loadingGaps, setLoadingGaps] = useState(false)
  // AI Auto-Assign All Gaps
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoProgress, setAutoProgress] = useState(0)
  const [autoLog, setAutoLog] = useState([])

  const subjectEmp = subject || (Array.isArray(people) && people.length > 0 ? people[0] : null)
  const employeeId = subjectEmp?.id || subjectEmp?.employee_id
  const subjectName = subjectEmp?.full_name || 'Employee'
  const isEmployee = role === 'employee'

  // Stable loadGaps — loads real gaps AND existing persistent assignments from DB
  const loadGaps = useCallback(async (cancelledRef = { current: false }) => {
    if (!employeeId) return
    setLoadingGaps(true)
    setError('')
    try {
      const [result, assignResult] = await Promise.all([
        api.learningSkillGaps({ employeeId }),
        api.learningAssignments().catch(() => ({ assignments: [] })),
      ])
      if (cancelledRef.current) return
      const list = Array.isArray(result?.gaps) ? result.gaps : []
      setGaps(list)
      setSelectedCompetency(prev =>
        list.some(g => g.competency === prev) ? prev : (list[0]?.competency || '')
      )

      // Populate assignedMap from persistent database assignments for this employee
      const persistentMap = {}
      for (const a of assignResult.assignments || []) {
        if (a.employee_id === employeeId || !employeeId) {
          for (const c of a.competencies || []) {
            persistentMap[c] = a.resource_title
          }
          if (a.fromCompetencyGap && a.category) {
            persistentMap[a.category] = a.resource_title
          }
        }
      }
      setAssignedMap(prev => ({ ...persistentMap, ...prev }))
    } catch (err) {
      if (!cancelledRef.current) setError(err?.message || 'Could not load skill gaps.')
    } finally {
      if (!cancelledRef.current) setLoadingGaps(false)
    }
  }, [employeeId])

  useEffect(() => {
    const ref = { current: false }
    void loadGaps(ref)
    return () => { ref.current = true }
  }, [loadGaps])

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
        ...safeValue,
        planTitle: safeValue.planTitle || `Dev Plan: ${selectedCompetency}`,
        assignedCourse: course.title,
        prioritySkills: Array.isArray(safeValue.prioritySkills)
          ? [...new Set([...safeValue.prioritySkills, selectedCompetency])]
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

  // AI Auto-Assign: iterate every unassigned gap, pick best course, assign it.
  const handleAutoAssignAll = async () => {
    const unassigned = gaps.filter(g => !assignedMap[g.competency])
    if (!unassigned.length || !employeeId) return
    setAutoAssigning(true)
    setAutoProgress(0)
    setAutoLog([])
    setNotice('')
    setError('')

    const newMap = { ...assignedMap }
    const log = []
    const allAssigned = []

    for (let i = 0; i < unassigned.length; i++) {
      const g = unassigned[i]
      // Pick the best course for this gap
      const courses = g.courses?.length
        ? g.courses
        : getRecommendedCoursesForGap(g.competency, g.score || 0)
      const course = courses[0]
      if (!course) {
        log.push({ gap: g.competency, course: null, status: 'skip' })
        setAutoLog([...log])
        setAutoProgress(Math.round(((i + 1) / unassigned.length) * 100))
        continue
      }

      try {
        await api.assignLearningGap({
          subjectEmployeeId: employeeId,
          courseTitle: course.title,
          competencyName: g.competency,
          gapScore: g.gap || 0,
        })
        newMap[g.competency] = course.title
        allAssigned.push(g.competency)
        log.push({ gap: g.competency, course: course.title, status: 'ok' })
      } catch (err) {
        log.push({ gap: g.competency, course: course.title, status: 'error', msg: err.message })
      }

      setAssignedMap({ ...newMap })
      setAutoLog([...log])
      setAutoProgress(Math.round(((i + 1) / unassigned.length) * 100))

      // Small delay between assignments so the server isn't hammered
      if (i < unassigned.length - 1) await new Promise(r => setTimeout(r, 280))
    }

    // Commit all assigned competencies to the parent form value
    if (allAssigned.length > 0) {
      onChange({
        ...safeValue,
        planTitle: safeValue.planTitle || `AI Dev Plan: ${subjectName}`,
        prioritySkills: [...new Set([...(Array.isArray(safeValue.prioritySkills) ? safeValue.prioritySkills : []), ...allAssigned])],
        assignedFromCompetencyGap: true,
        aiAutoAssigned: true,
      })
    }

    setAutoAssigning(false)
    setNotice(
      allAssigned.length > 0
        ? `AI assigned ${allAssigned.length} development ${allAssigned.length === 1 ? 'plan' : 'plans'} to ${subjectName} targeting all detected skill gaps.`
        : 'No courses could be assigned. Please check the error log above.'
    )
    await loadGaps()
  }

  const set = patch => onChange({ ...safeValue, ...patch })

  return (
    <div className="builder skill-gap-builder">
      {/* Skill Gaps Overview */}
      <div className="skill-gaps-section">
        <div className="section-head">
          <div>
            <h4>Detected Skill Gaps for {subjectName}</h4>
            <span className="section-hint">Click a skill gap to view recommended learning courses</span>
          </div>
          {/* AI Auto-Assign Button */}
          {gaps.length > 0 && (
            <button
              type="button"
              className="ai-auto-assign-btn"
              disabled={autoAssigning || assigning || gaps.every(g => assignedMap[g.competency])}
              onClick={handleAutoAssignAll}
              title="AI will automatically pick and assign the best-matching development course for every skill gap in one click"
            >
              <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              {autoAssigning ? `Assigning… ${autoProgress}%` : 'AI Auto-Assign All Gaps'}
            </button>
          )}
        </div>

        {/* AI Progress Bar */}
        {autoAssigning && (
          <div style={{ margin: '6px 0 2px', background: 'rgba(124,58,237,0.08)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(124,58,237,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>AI is assigning development plans…</span>
              <span style={{ fontSize: 11, color: '#7c3aed' }}>{autoProgress}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(124,58,237,0.15)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${autoProgress}%`, background: 'linear-gradient(90deg, #7c3aed, #10b981)', borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* AI Assignment Log */}
        {autoLog.length > 0 && !autoAssigning && (
          <div style={{ margin: '6px 0', background: 'rgba(16,185,129,0.05)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(16,185,129,0.18)', maxHeight: 140, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 5 }}>AI Assignment Summary</div>
            {autoLog.map((entry, idx) => (
              <div key={idx} style={{ fontSize: 11, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                {entry.status === 'ok'
                  ? <CheckCircle size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                  : entry.status === 'skip'
                  ? <AlertTriangle size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  : <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                }
                <span style={{ color: 'inherit', fontWeight: 600 }}>{entry.gap}:</span>
                <span style={{ color: entry.status === 'ok' ? '#10b981' : entry.status === 'skip' ? '#94a3b8' : '#ef4444' }}>
                  {entry.status === 'ok' ? entry.course : entry.status === 'skip' ? 'No course found' : `Error – ${entry.msg}`}
                </span>
              </div>
            ))}
          </div>
        )}

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
                    ? <span className="gap-pill assigned-pill"><CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Course assigned</span>
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
                  <span className="course-duration" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {course.duration_hours || course.duration || '-'} hrs</span>
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
                    ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Learning Path Assigned</>
                    : assigning ? 'Assigning…' : <><Zap size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Assign Learning Path</>}
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
            value={safeValue.coachingNotes || ''}
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
  const [selectedSkill, setSelectedSkill] = useState('')

  const apply = pos => {
    if (!pos) { onChange([]); return }
    const rows = COMPETENCY_TEMPLATES[pos].map(r => ({
      position: pos,
      competency: r.competency,
      level: r.level || 'Proficient',
      weight: r.weight || 20,
      category: r.category || 'Competency',
      targetScore: r.targetScore || LEVEL_SCORES[r.level] || 85,
      actual: Math.max(40, Math.min(100, Math.round((r.targetScore || LEVEL_SCORES[r.level] || 85) * (0.8 + Math.random() * 0.25)))),
    }))
    onChange(rows)
    if (rows.length > 0) setSelectedSkill(rows[0].competency)
  }

  const addCustomSkill = () => {
    const next = [
      ...value,
      {
        position: value[0]?.position || 'Custom Role',
        competency: 'New Competency',
        level: 'Proficient',
        weight: 15,
        category: 'Hospitality Service',
        targetScore: 88,
        actual: 75,
      }
    ]
    onChange(next)
  }

  const totalWeight = value.reduce((s, r) => s + Number(r.weight || 0), 0)
  const levelColor = lvl => ({ Foundation: '#8a8792', Developing: '#b06948', Proficient: '#5d49be', Expert: '#31965b' }[lvl] || '#5d49be')

  return (
    <div className="builder competency-template-builder" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="competency-picker-field">
        <label className="competency-picker-label">
          <span>Select a Role-Based Benchmark Template</span>
          <select value={value.length > 0 ? value[0].position : ''} onChange={e => apply(e.target.value)}>
            <option value="">Choose a hospitality role benchmark…</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos} ({COMPETENCY_TEMPLATES[pos].length} benchmark competencies)</option>
            ))}
          </select>
          <small>Select a predefined hospitality role dictionary standard to auto-load standard competency benchmarks, proficiency target levels, and weights.</small>
        </label>
      </div>

      {value.length > 0 && (
        <>
          {/* Interactive Skill Radar Chart Visual Comparison */}
          <div style={{ marginTop: 4 }}>
            <SkillRadarChart
              competencies={value}
              roleName={value[0].position}
              employeeName="Subject Profile"
              selectedCompetency={selectedSkill}
              onSelectCompetency={setSelectedSkill}
              showTable={false}
              compact={false}
            />
          </div>

          <div className="competency-loaded">
            <div className="competency-loaded-head">
              <div>
                <b>{value[0].position} · Role Benchmark Matrix</b>
                <small>Predefined standard loaded — adjust requirements, targets, and weights as needed</small>
              </div>
              <span className={`weight-total ${totalWeight === 100 ? 'ok' : ''}`}>Total Weight: {totalWeight}%</span>
            </div>
            <div className="competency-table">
              {value.map((row, index) => (
                <div
                  className={`competency-table-row ${selectedSkill === row.competency ? 'selected-row' : ''}`}
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(110px, 1fr) 90px 80px 32px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                    background: selectedSkill === row.competency ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                    borderRadius: 6,
                  }}
                  onClick={() => setSelectedSkill(row.competency)}
                >
                  <div className="competency-table-name">
                    <input
                      value={row.competency}
                      placeholder="Competency name"
                      onChange={e => {
                        const next = [...value]; next[index] = { ...row, competency: e.target.value }; onChange(next)
                      }}
                    />
                  </div>
                  <div className="competency-table-level">
                    <select
                      value={row.level}
                      style={{ borderColor: levelColor(row.level) }}
                      onChange={e => {
                        const lvl = e.target.value
                        const next = [...value]
                        next[index] = {
                          ...row,
                          level: lvl,
                          targetScore: LEVEL_SCORES[lvl] || 85,
                        }
                        onChange(next)
                      }}
                    >
                      <option value="">Level…</option>
                      {COMPETENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="competency-table-target" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <small style={{ fontSize: 10, color: '#64748b' }}>Target:</small>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={row.targetScore || LEVEL_SCORES[row.level] || 85}
                      onChange={e => {
                        const next = [...value]
                        next[index] = { ...row, targetScore: Number(e.target.value) }
                        onChange(next)
                      }}
                      style={{ width: 44, padding: '4px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}
                    />
                    <small style={{ fontSize: 10, color: '#64748b' }}>%</small>
                  </div>
                  <div className="competency-table-weight">
                    <input
                      type="number"
                      value={row.weight}
                      onChange={e => {
                        const next = [...value]; next[index] = { ...row, weight: e.target.value }; onChange(next)
                      }}
                      min={0}
                      max={100}
                      placeholder="Weight %"
                      title="Weight percentage"
                    />
                    <i className="weight-bar"><em style={{ width: `${Math.min(100, Number(row.weight) || 0)}%` }} /></i>
                  </div>
                  <button type="button" className="builder-remove" onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, i) => i !== index)) }} aria-label="Delete">×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button type="button" className="builder-add" onClick={addCustomSkill} style={{ margin: 0, padding: '6px 14px', fontSize: 12 }}>
                + Add Custom Skill Dimension
              </button>
              <small style={{ color: totalWeight === 100 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {totalWeight === 100 ? '✓ Total weight perfectly balanced at 100%' : `⚠ Total weight is ${totalWeight}% (must equal 100%)`}
              </small>
            </div>
          </div>
        </>
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

// ------------------------- Builder: Resources (from Learning Management) ---

function ResourcesBuilder({ value = [], onChange }) {
  const [lmResources, setLmResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    api.learningResources().then(res => {
      if (active) {
        setLmResources(res.resources || [])
        setLoading(false)
      }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const linkedIds = new Set(value.map(r => r.id))
  const categories = [...new Set(lmResources.map(r => r.category).filter(Boolean))]

  const filtered = lmResources.filter(r => {
    const q = searchQ.toLowerCase()
    const matchQ = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q)
    const matchCat = !catFilter || r.category === catFilter
    return matchQ && matchCat
  })

  const link = (resource) => {
    if (linkedIds.has(resource.id)) return
    onChange([...value, {
      id: resource.id,
      name: resource.title,
      type: resource.provider_type === 'video' ? 'Video' : resource.provider_type === 'pdf' ? 'PDF' : 'Link',
      url: resource.url || '',
      category: resource.category,
      duration: resource.duration_hours,
      description: resource.description,
    }])
    setNotice(`"${resource.title}" linked to this competency plan.`)
    setTimeout(() => setNotice(''), 3000)
  }

  const unlink = (id) => onChange(value.filter(r => r.id !== id))

  return (
    <div className="builder lm-resources-builder">

      {/* Linked Resources Summary */}
      {value.length > 0 && (
        <div className="lm-linked-summary">
          <div className="lm-linked-summary-title">
            <Sparkles size={13} />
            <span>{value.length} Learning Resource{value.length !== 1 ? 's' : ''} Linked to Plan</span>
          </div>
          <div className="lm-linked-tags-wrap">
            {value.map((r, i) => (
              <span key={r.id || i} className="lm-linked-tag">
                {r.name}
                <button type="button" className="lm-unlink-btn" onClick={() => unlink(r.id)} aria-label="Unlink">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {notice && <div className="assigned-success-notice">{notice}</div>}

      {/* Filter Bar */}
      <div className="lm-filter-bar">
        <div className="lm-filter-input-wrap">
          <Search size={13} className="lm-filter-icon" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search learning resources…"
            className="lm-filter-input"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="lm-filter-select"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Resource Cards from Learning Management */}
      {loading ? (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '20px 0' }}>Loading learning resources…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '20px 0' }}>No resources found. Add resources in Learning Management first.</p>
      ) : (
        <div className="lm-resources-grid">
          {filtered.map(resource => {
            const isLinked = linkedIds.has(resource.id)
            return (
              <div
                key={resource.id}
                className={`lm-resource-card ${isLinked ? 'linked' : ''}`}
              >
                <div className="lm-card-head">
                  <span className="lm-card-category">
                    {resource.category || 'General'}
                  </span>
                  {resource.duration_hours && (
                    <span className="lm-card-duration">
                      <Clock size={11} /> {resource.duration_hours}h
                    </span>
                  )}
                </div>
                <h5 className="lm-card-title">{resource.title}</h5>
                {resource.description && (
                  <p className="lm-card-desc">
                    {resource.description}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isLinked}
                  onClick={() => link(resource)}
                  className={`lm-link-btn ${isLinked ? 'linked' : ''}`}
                >
                  {isLinked ? (
                    <><CheckCircle size={13} /> Linked to Plan</>
                  ) : (
                    <><Zap size={13} /> + Link to Plan</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
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

// ------------------------- Builder: Training Invite -----------------------

function TrainingInviteBuilder({ value = {}, onChange, people = [] }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  useEffect(() => {
    let mounted = true
    api.trainingSessions()
      .then(res => {
        if (mounted) setSessions(res.sessions || [])
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const selectedSessionId = value.sessionId || ''
  const selectedEmpIds = Array.isArray(value.employeeIds) ? value.employeeIds : []

  const handleSessionChange = sessionId => {
    const sess = sessions.find(s => s.id === sessionId) || null
    onChange({
      ...value,
      sessionId,
      sessionTitle: sess?.title || '',
      venue: sess?.venue || '',
      startDate: sess?.start_date || '',
    })
  }

  const toggleEmp = emp => {
    const isSelected = selectedEmpIds.includes(emp.id)
    const nextIds = isSelected ? selectedEmpIds.filter(id => id !== emp.id) : [...selectedEmpIds, emp.id]
    const nextNames = people.filter(p => nextIds.includes(p.id)).map(p => p.full_name)
    onChange({
      ...value,
      employeeIds: nextIds,
      employeeNames: nextNames,
    })
  }

  const selectedSess = sessions.find(s => s.id === selectedSessionId)

  const filteredEmployees = people.filter(p => {
    if (deptFilter && p.department !== deptFilter) return false
    if (search && !`${p.full_name} ${p.department} ${p.job_title || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const departments = [...new Set(people.map(p => p.department))].filter(Boolean)

  return (
    <div className="builder training-invite-builder" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="builder-note">
        Select a scheduled training session and multi-select employees to invite.
      </div>

      {/* 1. Session Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
          Select Scheduled Training Session *
        </label>
        <select
          value={selectedSessionId}
          onChange={e => handleSessionChange(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        >
          <option value="">Choose a Training Session…</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.title} — {String(s.start_date).slice(0, 10)} @ {s.venue} ({s.registered_count || 0}/{s.capacity} enrolled)
            </option>
          ))}
        </select>
        {sessions.length === 0 && !loading && (
          <small style={{ color: '#b91c1c' }}>No scheduled training sessions found in database. Create a session first in the Training Sessions Catalog.</small>
        )}
      </div>

      {/* Session Preview Badge */}
      {selectedSess && (
        <div style={{ background: '#f0edff', border: '1px solid #d5cefc', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <b style={{ color: '#5f48c5', fontSize: 14 }}>{selectedSess.title}</b>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {selectedSess.venue}</span> • <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {String(selectedSess.start_date).slice(0, 10)}</span> • <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {selectedSess.registered_count || 0}/{selectedSess.capacity} capacity</span>
            </div>
          </div>
          <span style={{ background: '#5f48c5', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{selectedSess.category}</span>
        </div>
      )}

      {/* 2. Employee Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
            Select Employees to Invite ({selectedEmpIds.length} selected) *
          </label>
          {filteredEmployees.length > 0 && (
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: '#5f48c5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => {
                const allIds = filteredEmployees.map(p => p.id)
                const nextIds = [...new Set([...selectedEmpIds, ...allIds])]
                const nextNames = people.filter(p => nextIds.includes(p.id)).map(p => p.full_name)
                onChange({ ...value, employeeIds: nextIds, employeeNames: nextNames })
              }}
            >
              + Select All Filtered ({filteredEmployees.length})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search employee name or job title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredEmployees.map(p => {
            const checked = selectedEmpIds.includes(p.id)
            return (
              <label
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: checked ? '#f0edff' : '#ffffff',
                  border: checked ? '1px solid #c4b8f3' : '1px solid #f3f4f6',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEmp(p)}
                />
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13, color: '#111827' }}>{p.full_name}</b>
                  <small style={{ display: 'block', color: '#6b7280', fontSize: 11 }}>
                    {p.job_title ? `${p.job_title} — ` : ''}{p.department}
                  </small>
                </div>
              </label>
            )
          })}
          {filteredEmployees.length === 0 && (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: 12, fontSize: 13, margin: 0 }}>No employees match your search criteria.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------- Builder: Progress tracker -----------------------

// ------------------------- Builder: Progress tracker -----------------------

function ProgressBuilder({ value = [], onChange, role, people = [], subject, events = [] }) {
  const [dbAssignments, setDbAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [notice, setNotice] = useState('')

  const subjectEmp = subject || (Array.isArray(people) && people.length > 0 ? people[0] : null)
  const employeeId = subjectEmp?.id || subjectEmp?.employee_id
  const subjectName = subjectEmp?.full_name || 'Employee'
  const isEmployee = role === 'employee'

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.learningAssignments()
      const list = res.assignments || []
      const filtered = employeeId ? list.filter(a => a.employee_id === employeeId) : list
      setDbAssignments(filtered)
      if (filtered.length > 0 && (!value || !value.length)) {
        onChange(filtered.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      }
    } catch {
      // Fallback to value prop if API fails
    } finally {
      setLoading(false)
    }
  }, [employeeId, onChange, value])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  const handleUpdateProgress = async (assignment, newProgress) => {
    setUpdatingId(assignment.id)
    try {
      await api.updateLearningProgress(assignment.id, newProgress)
      const updated = dbAssignments.map(a => a.id === assignment.id ? { ...a, progress: newProgress, status: newProgress >= 100 ? 'completed' : newProgress > 0 ? 'studying' : a.status } : a)
      setDbAssignments(updated)
      onChange(updated.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      setNotice(`Updated progress for "${assignment.resource_title}" to ${newProgress}%.`)
    } catch (err) {
      setNotice(`Failed to update progress: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateStatus = async (assignment, newStatus) => {
    setUpdatingId(assignment.id)
    try {
      await api.updateLearningStatus(assignment.id, newStatus)
      const updated = dbAssignments.map(a => a.id === assignment.id ? { ...a, status: newStatus } : a)
      setDbAssignments(updated)
      onChange(updated.map(a => ({ name: a.resource_title, progress: a.progress || 0, status: a.status, assignmentId: a.id })))
      setNotice(`Updated status for "${assignment.resource_title}" to ${newStatus.replace('_', ' ')}.`)
    } catch (err) {
      setNotice(`Failed to update status: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="builder progress-builder" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {notice && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700 }}>
            {isEmployee ? 'My Assigned Development Plans & Learning Paths' : `Assigned Learning Progress for ${subjectName}`}
          </h4>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {isEmployee ? 'Track your study progress and update your completion status.' : 'Review learner completion against assigned competency development plans.'}
          </span>
        </div>
        {loading && <small style={{ color: '#8b5cf6', fontSize: 11 }}>Syncing progress…</small>}
      </div>

      {/* Real database assignments list */}
      {dbAssignments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dbAssignments.map(a => (
            <div
              key={a.id}
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--border, #e5e3ee)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b style={{ fontSize: 12.5, color: 'inherit' }}>{a.resource_title}</b>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                      {a.category || 'Skill Development'}
                    </span>
                    {a.duration_hours && (
                      <span style={{ fontSize: 10, color: '#64748b' }}>· {a.duration_hours} hrs</span>
                    )}
                    {(a.competencies || []).map(c => (
                      <span key={c} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                        ✦ Closes gap in {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={a.status || 'not_started'}
                    onChange={e => handleUpdateStatus(a, e.target.value)}
                    disabled={updatingId === a.id || a.is_completed}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    <option value="not_started">Not started</option>
                    <option value="studying">Studying</option>
                    <option value="completed">Completed</option>
                    <option value="need_help">Need help</option>
                  </select>
                  {a.is_completed && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#d1fae5', color: '#065f46' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Slider & Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${a.progress || 0}%`,
                      background: a.progress >= 100 ? '#10b981' : 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <b style={{ fontSize: 11.5, minWidth: 36, textAlign: 'right' }}>{a.progress || 0}%</b>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={a.progress || 0}
                  disabled={updatingId === a.id || a.is_completed}
                  onChange={e => handleUpdateProgress(a, Number(e.target.value))}
                  style={{ width: 100, cursor: 'pointer' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.2)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 600, color: 'inherit' }}>
            No development courses assigned yet.
          </p>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            HR and supervisors assign development plans and courses in the <b>Assign development plan</b> step.
          </small>
        </div>
      )}
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
  trainingInvite: { Component: TrainingInviteBuilder, initial: () => ({ sessionId: '', employeeIds: [] }) },
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
      if (formConfig.builder === 'trainingInvite') {
        return Boolean(value?.sessionId && Array.isArray(value?.employeeIds) && value.employeeIds.length > 0)
      }
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
        <small className="form-status">{isRequiredFilled ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Ready to complete</> : 'Complete required fields to continue'}</small>
      </div>
    </form>
  )
}

