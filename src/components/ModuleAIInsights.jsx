import { useState } from 'react'
import { api } from '../lib/api'
import AIReport from './AIReport'

export default function ModuleAIInsights({ module, stage }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })()
  const canGenerate = role !== 'operations_manager'
  const [insights, setInsights] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generate = async () => {
    setLoading(true); setError('')
    try { setInsights((await api.generateModuleInsights(module, stage)).insights) }
    catch (requestError) { setError(requestError.message); setInsights(null) }
    finally { setLoading(false) }
  }
  return <aside className="module-insights insight-panel"><div className="insight-title"><div><h2>AI Insights</h2><p>{canGenerate ? 'Organization view' : 'Read-only organization view'}</p></div>{canGenerate && <button className="ai-generate" onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate AI insight'}</button>}</div>{error && <p className="ai-error">{error}</p>}{loading ? <div className="insight-empty"><b>Analyzing module data</b><p>Reviewing the current workflow records for this module.</p></div> : insights ? <div className="insight-results"><AIReport insights={insights}/></div> : <div className="insight-empty"><b>{canGenerate ? 'Ready to analyze' : 'Monitoring access'}</b><p>{canGenerate ? 'Generate a module-specific summary from the current database workflow data.' : 'AI-generated insights are restricted to authorized workflow roles.'}</p></div>}</aside>
}
