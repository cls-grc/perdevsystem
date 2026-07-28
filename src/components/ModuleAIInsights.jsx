import { useState } from 'react'
import { api } from '../lib/api'

export default function ModuleAIInsights({ module, stage }) {
  const [insights, setInsights] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const generate = async () => { setLoading(true); setError(''); try { setInsights((await api.generateModuleInsights(module, stage)).insights) } catch (requestError) { setError(requestError.message); setInsights(null) } finally { setLoading(false) } }
  return <aside className="module-insights insight-panel"><div className="insight-title"><div><h2>AI Insights</h2><p>Organization view</p></div><button className="ai-generate" onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate AI insight'}</button></div>{error && <p className="ai-error">{error}</p>}{loading ? <div className="insight-empty"><b>Analyzing module data</b><p>Reviewing the current workflow records for this module.</p></div> : insights ? <div className="insight-results">{insights.map(insight => <article key={insight.title}><h3>{insight.title}</h3><p>{insight.summary}</p></article>)}</div> : <div className="insight-empty"><b>Ready to analyze</b><p>Generate a module-specific summary from the current database workflow data.</p></div>}</aside>
}
