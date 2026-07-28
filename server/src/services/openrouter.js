import { config } from '../config.js'

const moduleFocus = {
  performance: 'Focus exclusively on review-cycle progress, KPI completion, ratings/calibration bottlenecks, feedback quality, and the next role action.',
  competency: 'Focus exclusively on competency gaps, development-plan coverage, skill assessment progress, and recommended development actions.',
  learning: 'Focus exclusively on course enrollment, learning completion, assessment progress, overdue learning, and competency-record updates.',
  training: 'Focus exclusively on scheduled sessions, invitations, attendance, completion, learner effectiveness feedback, and training outcomes.',
  succession: 'Focus exclusively on critical-role coverage, candidate nominations, readiness assessment progress, approval bottlenecks, and succession risk.',
  recognition: 'Focus exclusively on nominations, supervisor validation, HR review status, recognition turnaround time, and recognition activity.',
}

function systemPrompt(context) {
  const module = context?.moduleWorkflow?.module
  const focus = module ? moduleFocus[module] : 'Focus on the supplied organization-wide performance, learning, and active workflow data.'
  return `You are an HR development analytics assistant. ${focus} Use only the supplied aggregate data and current workflow data. Do not discuss unrelated modules. Return valid JSON only: {"insights":[{"title":"string","summary":"string"}]}. Provide exactly 4 concise, practical insights. Do not invent people, facts, trends, or sensitive data.`
}

function localInsights(context) {
  const module = context?.moduleWorkflow?.module
  const stage = context?.moduleWorkflow?.stage || 'the current workflow stage'
  const active = context?.activeModuleWorkflows || context?.activeWorkflows || []
  const activeCount = active.reduce((total, item) => total + Number(item.count || 0), 0)
  const workforce = context?.workforce || {}
  const focused = {
    performance: ['Review-cycle status', `${activeCount} active performance workflow(s) are currently recorded. Prioritize actions waiting at ${stage.toLowerCase()}.`, 'Review action', 'Ensure KPI evidence, feedback, and approvals are recorded before the next review step.'],
    competency: ['Competency progress', `${activeCount} active skill-development workflow(s) are currently recorded. Focus on the competency requirements and plans in the current stage.`, 'Development action', 'Use the current competency evidence to assign or update the relevant development plan.'],
    learning: ['Learning progress', `${activeCount} active learning workflow(s) are currently recorded. Focus on enrollments, activity completion, and assessment follow-through.`, 'Learning action', 'Resolve overdue learning activities before updating competency records.'],
    training: ['Training delivery', `${activeCount} active training workflow(s) are currently recorded. Focus on session readiness, attendance, and effectiveness feedback.`, 'Training action', 'Record attendance and feedback promptly so the training outcome is reflected in the workflow.'],
    succession: ['Succession readiness', `${activeCount} active succession workflow(s) are currently recorded. Focus on nominations, readiness evidence, and required approvals.`, 'Succession action', 'Confirm the candidate evidence before moving the plan to the next approval role.'],
    recognition: ['Recognition progress', `${activeCount} active recognition workflow(s) are currently recorded. Focus on timely validation and review of nominations.`, 'Recognition action', 'Record a clear achievement summary before completing the current recognition step.'],
  }[module]
  if (focused) return [{ title: focused[0], summary: focused[1] }, { title: focused[2], summary: focused[3] }, { title: 'Current stage', summary: `The current focus is ${stage.toLowerCase()}. Complete the evidence and notes required for this role.` }, { title: 'Data source', summary: 'This insight was generated from the current database workflow records because the external AI provider was unavailable.' }]
  return [{ title: 'Workforce summary', summary: `Current database averages: performance ${workforce.average_performance ?? 0}%, competency ${workforce.average_competency ?? 0}%, and learning ${workforce.learning_completion ?? 0}%.` }, { title: 'Active workflows', summary: `${activeCount} active workflow record(s) are currently available for review.` }, { title: 'Recommended action', summary: 'Review the current workflow stages and complete the actions assigned to each role.' }, { title: 'Data source', summary: 'This insight was generated from current database records because the external AI provider was unavailable.' }]
}

export async function generateInsights(context) {
  if (!config.openRouterApiKey) return localInsights(context)
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.openRouterApiKey}`, 'Content-Type': 'application/json', Accept: 'application/json', 'HTTP-Referer': config.clientOrigin, 'X-OpenRouter-Title': 'PerDevSys' },
        body: JSON.stringify({ model: config.openRouterModel, temperature: 0.3, max_tokens: 550, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemPrompt(context) }, { role: 'user', content: JSON.stringify(context) }] }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = Object.assign(new Error(payload.error?.message || 'OpenRouter could not generate insights.'), { status: response.status === 401 ? 502 : response.status })
        if (response.status >= 500 || response.status === 429) { lastError = error; continue }
        throw error
      }
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw Object.assign(new Error('The AI service returned an empty response.'), { status: 502 })
      const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''))
      if (!Array.isArray(parsed.insights)) throw new Error('Missing insights')
      return parsed.insights.slice(0, 4)
    } catch (error) {
      lastError = error.name === 'AbortError' ? Object.assign(new Error('The AI request timed out. Please try again.'), { status: 504 }) : error
      if (attempt === 0 && (!error.status || error.status >= 500)) continue
    } finally { clearTimeout(timeout) }
  }
  console.warn(`External AI unavailable; returning database-based insights: ${lastError?.message || 'unknown error'}`)
  return localInsights(context)
}
