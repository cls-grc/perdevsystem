import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import AIReport from '../components/AIReport'

const initials = name => name.split(' ').map(part => part[0]).join('').slice(0, 2)
const percent = value => `${Number(value || 0)}%`

export default function AIAnalytics() {
  const [data, setData] = useState(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [insights, setInsights] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  // Only HR can generate a new executive report; operations_manager and management are read-only.
  const canGenerate = role !== 'operations_manager' && role !== 'management'
  const isHr = role === 'hr'

  const load = async () => {
    try { setData(await api.analytics()); setError('') } catch (requestError) { setError(requestError.message) }
  }
  const loadExecutive = async () => {
    try {
      const result = await api.executiveReport()
      setReport(result.report || null)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }
  useEffect(() => {
    // Load dashboard metrics + latest saved executive report (no regeneration on refresh).
    void Promise.all([load(), loadExecutive()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const employees = useMemo(() => (data?.employees || []).filter(employee => `${employee.full_name} ${employee.department}`.toLowerCase().includes(query.toLowerCase())), [data, query])
  const generate = async (employee = null) => {
    if (!canGenerate) return
    setSelected(employee); setGenerating(true)
    try {
      setInsights((await api.generateInsights(employee?.full_name)).insights); setError('')
    } catch (requestError) { setError(requestError.message) }
    finally { setGenerating(false) }
  }
  const generateExecutive = async () => {
    if (!isHr) return
    setGenerating(true)
    try {
      const result = await api.generateExecutiveReport()
      setInsights(null)
      setReport(result.report ?? null)
      setError('')
    } catch (requestError) { setError(requestError.message) }
    finally { setGenerating(false) }
  }

  if (loading) return <main className="ai-dashboard"><div className="dashboard-skeleton"><i/><i/><i/><i/></div></main>
  const totals = data?.totals || {}
  const workflowTotal = (data?.workflowBreakdown || []).reduce((sum, item) => sum + Number(item.count), 0)
  const completed = (data?.workflowBreakdown || []).filter(item => item.status === 'completed').reduce((sum, item) => sum + Number(item.count), 0)
  const averagePerformance = Number(totals.average_performance || 0)
  const averageLearning = Number(totals.learning_completion || 0)
  const departments = [...new Set((data?.employees || []).map(employee => employee.department))].slice(0, 4)

  return <main className="ai-dashboard">
<div className="ai-heading"><div><h1>AI-Assisted Performance & Learning Analytics</h1><p>Live hospitality performance, learning, and readiness intelligence.</p></div>{isHr && <div className="ai-actions"><button onClick={generateExecutive} disabled={generating}>{generating ? 'Generating...' : 'Generate New Report'}</button></div>}</div>
    {error && <p className="ai-service-note">{error}</p>}
    <section className="ai-content">
      <div className="ai-main">
        <section className="ai-kpis">{[['Total employees', totals.total_employees], ['Average performance', percent(totals.average_performance)], ['Learning completion', percent(totals.learning_completion)], ['Succession ready', totals.succession_ready]].map(([label, value]) => <article key={label} title="Live value from the current database"><small>{label}</small><b>{value ?? '0'}</b><em>Live database value</em></article>)}</section>
        <section className="analytics-visuals">
          <article className="radar-card"><div><small>Competency overview</small><b>Hospitality capability mix</b></div><svg viewBox="0 0 180 150" aria-label="Competency radar chart"><g className="radar-grid"><polygon points="90,10 145,48 124,122 56,122 35,48"/><polygon points="90,32 123,55 110,103 70,103 57,55"/><line x1="90" y1="10" x2="90" y2="122"/><line x1="35" y1="48" x2="124" y2="122"/><line x1="145" y1="48" x2="56" y2="122"/></g><polygon className="radar-fill" points="90,23 132,57 112,111 63,107 49,56"/></svg><div className="radar-labels"><span>Service</span><span>Leadership</span><span>Safety</span><span>Teamwork</span><span>Operations</span></div></article>
          <article className="progress-card"><small>Learning and performance</small><b>Development momentum</b><div className="bar-row"><span>Performance</span><i><em style={{ width: `${averagePerformance}%` }}/></i><strong>{averagePerformance}%</strong></div><div className="bar-row"><span>Learning</span><i><em style={{ width: `${averageLearning}%` }}/></i><strong>{averageLearning}%</strong></div></article>
          <article className="heat-card"><small>Competency heat map</small><b>Department readiness</b><div className="heat-map">{departments.map((department, index) => <span key={department} className={`heat-${index + 1}`}>{department.slice(0, 2)}</span>)}</div><p>Current department coverage from workforce records.</p></article>
        </section>
        <section className="ai-chart-row">{[['Active workflows', workflowTotal], ['Completed workflows', completed], ['Training completion', percent(totals.learning_completion)]].map(([label, value]) => <article key={label}><small>{label}</small><b>{value}</b><span>Current workforce signal</span></article>)}</section>
        <section className="ai-records"><div><h2>Hotel and restaurant workforce progress</h2><label className="employee-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search employee or department"/></label></div><table><thead><tr><th>Employee</th><th>Department</th><th>Performance</th><th>Learning progress</th></tr></thead><tbody>{employees.map((employee, index) => <tr key={employee.id} onClick={canGenerate ? () => generate(employee) : undefined} className={selected?.id === employee.id ? 'selected-employee' : ''}><td><i className={`table-avatar av-${index}`}>{initials(employee.full_name)}</i>{employee.full_name}</td><td>{employee.department}</td><td><span className="inline-progress"><i style={{ width: percent(employee.performance_score) }}/></span>{percent(employee.performance_score)}</td><td><span className="inline-progress green"><i style={{ width: percent(employee.learning_progress) }}/></span>{percent(employee.learning_progress)}</td></tr>)}</tbody></table>{employees.length === 0 && <p className="no-results">No employee records match your search.</p>}</section>
      </div>
      <aside className="insight-panel ai-results-panel"><div className="insight-title"><div><h2>{selected ? `${selected.full_name} analytics` : 'AI Insights'}</h2><p>{selected ? 'Individual hospitality profile' : report ? 'Saved executive report' : 'Organization view'}</p></div><span className="live-badge">{isHr ? 'AI ready' : 'Read only'}</span></div>
        {report && !selected && !insights ? (
          <div className="insight-results">
<div className="report-meta">
              <span className="report-date">Generated {new Date(report.created_at).toLocaleString()}{report.generated_by_name ? ` by ${report.generated_by_name}` : ''}</span>
              {report.metrics_json && <span className="data-backed-chip" title="Report is based on calculated database metrics">✓ Data-backed</span>}
            </div>
            <AIReport content={report.content} title={report.title} />
          </div>
        ) : insights ? <div className="insight-results"><AIReport insights={insights}/></div> : <div className="insight-empty"><b>{canGenerate ? 'AI workforce brief ready' : 'Monitoring access'}</b><p>{canGenerate ? 'Generate a workforce analytics report from the current database values.' : 'View current workforce metrics and workflow activity. Executive report generation is restricted to HR.'}</p>{canGenerate && <button className="insight-cta" onClick={() => generate()} disabled={generating}>Create workforce brief</button>}</div>}
      </aside>
    </section>
  </main>
}
