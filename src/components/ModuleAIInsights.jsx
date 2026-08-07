import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import AIReport from './AIReport'

const percent = value => `${Number(value || 0)}%`

// Human-friendly metric labels mapped from the stored metrics_json keys so the
// Metrics Preview panel shows only calculated database values (no AI).
const METRIC_LABELS = {
  employee_count: 'Employees',
  average_score: 'Average Score',
  average_readiness: 'Average Readiness',
  average_performance: 'Average Performance',
  average_competency: 'Average Competency',
learning_completion: 'Learning Completion',
  learning_progress: 'Learning Progress',
  resource_count: 'Courses',
  assigned_count: 'Assignments',
  completed_count: 'Completed',
  active_count: 'Active',
  ready_now_count: 'Ready Now',
  candidate_count: 'Candidates',
}

function formatMetricValue(key, value) {
  const num = Number(value)
  if (Number.isNaN(num)) return value ?? '0'
  if (['average_score', 'average_readiness', 'average_performance', 'average_competency', 'learning_completion', 'learning_progress'].includes(key)) return `${Math.round(num)}%`
  return String(Math.round(num))
}

// Derive a data-confidence indicator from the stored metrics: the more metric
// keys have non-zero / populated values, the more confident the report is.
function confidenceFromMetrics(metricsJson) {
  if (!metricsJson) return null
  const entries = Object.entries(metricsJson).filter(([key, value]) => value !== null && value !== undefined && value !== '')
  if (entries.length === 0) return null
  const populated = entries.filter(([key, value]) => {
    if (typeof value === 'number') return value > 0
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  }).length
  const score = Math.round((populated / entries.length) * 100)
  const level = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  return { score, level }
}

export default function ModuleAIInsights({ module, stage, workflowId }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const isHr = role === 'hr'
  // Employees can generate their own AI insight for their own validated
  // workflows; HR can generate for any workflow. Other roles are read-only.
  const canGenerateOwn = role === 'employee' || isHr
  const [savedReports, setSavedReports] = useState([])
  const [metricsPreview, setMetricsPreview] = useState(null)
  const [workflowMeta, setWorkflowMeta] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [viewingReport, setViewingReport] = useState(null)

  // Load saved AI reports + workflow meta (assigned user, dates, status) for
  // the selected workflow so the panel always shows live context.
  useEffect(() => {
    let cancelled = false
    const loadReports = async () => {
      if (!workflowId) { setSavedReports([]); setMetricsPreview(null); setWorkflowMeta(null); return }
      try {
        const [reportsResult, workflowResult] = await Promise.all([
          api.workflowReports(workflowId),
          api.workflow(workflowId).catch(() => ({ workflow: null })),
        ])
        if (cancelled) return
        setSavedReports(reportsResult.reports || [])
        setWorkflowMeta(workflowResult.workflow || null)
        // The metrics preview is the ai_report row that stores metrics but no
        // AI-enriched content (it is the "ready to generate" placeholder).
        const preview = (reportsResult.reports || []).find(r => !r.generated_by_model)
        setMetricsPreview(preview ? (preview.metrics_json || {}) : null)
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      }
    }
    void loadReports()
    return () => { cancelled = true }
  }, [workflowId])

const generate = async () => {
    if (!canGenerateOwn || !workflowId) return
    setGenerating(true); setError('')
    try {
      const result = await api.generateWorkflowReport(workflowId)
      const reports = await api.workflowReports(workflowId)
      setSavedReports(reports.reports || [])
      setMetricsPreview(null)
      setViewingReport(result.report || null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGenerating(false)
    }
  }

const downloadPdf = async report => {
    if (!report?.id) return
    try {
      const blob = await api.downloadReportPdf(report.id)
      if (!blob) { setError('PDF download is not available for this report.'); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(report.title || 'ai-report').replace(/\s+/g, '-').toLowerCase()}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

const latestGenerated = savedReports.find(r => r.generated_by_model) || null
  const hasGenerated = Boolean(latestGenerated)
  const status = hasGenerated ? 'Generated' : 'Ready to Generate'
  const previewEntries = metricsPreview ? Object.entries(metricsPreview).filter(([key]) => METRIC_LABELS[key]) : []
  const confidence = confidenceFromMetrics(latestGenerated?.metrics_json || metricsPreview)
  const dataSources = useMemo(() => {
    const json = latestGenerated?.metrics_json || metricsPreview || {}
    return Object.keys(json).filter(key => METRIC_LABELS[key])
  }, [latestGenerated, metricsPreview])

  // Records analyzed = populated metric values (each represents queried DB rows).
  const recordsAnalyzed = useMemo(() => {
    const json = latestGenerated?.metrics_json || metricsPreview || {}
    const keys = Object.keys(json).filter(key => METRIC_LABELS[key])
    return keys.length
  }, [latestGenerated, metricsPreview])

  const shownReport = viewingReport || latestGenerated
  const lastUpdated = workflowMeta?.updated_at || metricsPreview?.last_updated || latestGenerated?.created_at

  return <aside className="module-insights insight-panel">
    <div className="insight-title">
<div>
        <h2>AI Insights</h2>
        <p>{canGenerateOwn ? (isHr ? 'HR can generate / regenerate reports' : 'You can generate your own AI insight') : 'Read-only view'}</p>
      </div>
      <span className={`report-status-badge ${hasGenerated ? 'generated' : 'ready'}`}>{status}</span>
    </div>
    {error && <p className="ai-error">{error}</p>}

{/* Metrics Preview — calculated database values only, no AI */}
    {previewEntries.length > 0 && !hasGenerated && (
      <section className="metrics-preview">
        <div className="metrics-preview-head">
          <b>Metrics Summary</b>
          <small>Calculated from database</small>
        </div>
        <div className="metrics-ready-badge">✓ Metrics ready</div>
        <div className="metrics-preview-grid">
          {previewEntries.map(([key, value]) => (
            <article key={key}>
              <small>{METRIC_LABELS[key]}</small>
              <b>{formatMetricValue(key, value)}</b>
            </article>
          ))}
        </div>
        <div className="metrics-stats-row">
          <span><b>{recordsAnalyzed}</b> records analyzed</span>
        </div>
        {confidence && (
          <div className="metrics-confidence">
            <span>Data completeness</span>
            <i><em style={{ width: `${confidence.score}%` }} /></i>
            <b>{confidence.level} ({confidence.score}%)</b>
          </div>
        )}
        {lastUpdated && <small className="metrics-updated">Last updated: {new Date(lastUpdated).toLocaleString()}</small>}
      </section>
    )}

    {/* Generated report metadata */}
{hasGenerated && (
      <div className="report-meta">
        <span className="report-date">Generated {new Date(latestGenerated.created_at).toLocaleString()}</span>
        {latestGenerated.generated_by_model && <span className="model-chip">{latestGenerated.generated_by_model}</span>}
        <span className="records-chip">{recordsAnalyzed} records analyzed</span>
        {confidence && <span className={`confidence-chip ${confidence.level.toLowerCase()}`}>{confidence.level} confidence ({confidence.score}%)</span>}
      </div>
    )}

    {loading ? (
      <div className="insight-empty"><b>Analyzing module data</b><p>Reviewing the current workflow records for this module.</p></div>
    ) : shownReport && hasGenerated ? (
      <div className="insight-results">
        <AIReport content={shownReport.content} title={shownReport.title} />
        {dataSources.length > 0 && (
          <div className="report-sources">
            <small>Data sources analyzed</small>
            <div className="source-chips">
              {dataSources.map(source => <span key={source}>{METRIC_LABELS[source]}</span>)}
            </div>
          </div>
        )}
      </div>
    ) : (
<div className="insight-empty">
        <b>{canGenerateOwn ? 'Ready to Generate AI Insight' : 'No AI insight yet'}</b>
        <p>{canGenerateOwn
          ? (isHr
              ? 'Metrics have been calculated and saved. Generate the AI report when ready.'
              : 'Metrics for your validated workflow have been calculated. Generate your own AI insight when ready.')
          : 'An AI insight has not been generated for this workflow yet.'}</p>
      </div>
    )}

    {canGenerateOwn && workflowId && (
      <div className="module-actions report-actions">
        <button className="ai-generate" onClick={generate} disabled={generating}>
          {generating ? 'Generating...' : hasGenerated ? 'Regenerate' : isHr ? 'Generate AI Report' : 'Generate My AI Insight'}
        </button>
        {hasGenerated && (
          <div className="report-button-row">
            <button className="ai-secondary" onClick={() => setViewingReport(null)}>View Report</button>
            <button className="ai-secondary" onClick={() => downloadPdf(latestGenerated)}>Download PDF</button>
          </div>
        )}
      </div>
    )}
  </aside>
}
