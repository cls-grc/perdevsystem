import { config } from '../config.js'

// ---------------------------------------------------------------------------
// Real LLM integration via OpenRouter.
//
// When OPENROUTER_API_KEY is configured, insight generation calls the actual
// OpenRouter chat-completions endpoint. When no key is present (or the call
// fails), we fall back to the deterministic template-based reports so the
// product keeps working in demos and offline environments.
// ---------------------------------------------------------------------------

const n = value => Number(value || 0)
const pct = value => `${n(value)}%`
const total = rows => rows.reduce((sum, row) => sum + n(row.count), 0)
const queue = rows => rows[0] ? `${n(rows[0].count)} record(s) are currently at ${rows[0].current_stage.replaceAll('_', ' ')}` : 'no active workflow records are currently awaiting action'

const report = (title, paragraphs) => {
  const [overview = '', analysis = '', strengths = '', attention = '', recommendations = attention] = paragraphs
  return {
    title,
    summary: `# ${title}\n\n## Overview\n${overview}\n\n## Analysis\n${analysis}\n\n## Strengths\n${strengths}\n\n## Areas Requiring Attention\n${attention}\n\n## Recommendations\n${recommendations}`,
  }
}

// --------------------------- Template fallback ------------------------------

function moduleInsights({ moduleWorkflow, moduleMetrics: m = {}, moduleDetails: d = {}, activeModuleWorkflows: rows = [] }) {
  const active = total(rows)
  const currentQueue = queue(rows)
  const action = rows[0]
    ? `HR should review the ${rows[0].current_stage.replaceAll('_', ' ')} queue before progressing those records, ensuring the documented evidence and reviewer input are complete.`
    : 'HR should review the current records before initiating additional actions, so that development decisions remain grounded in the available evidence.'
  const reports = {
    performance: [report('Performance Management Report', [
      `Workforce overview. The performance review population includes ${n(m.employee_count)} active employee records with an average performance score of ${pct(m.average_score)}. There are ${n(m.completed_count)} completed reviews and ${n(m.active_count)} active review workflows, providing a current view of both workforce outcomes and review execution.`,
      d.top_name ? `Key findings. ${d.top_name} has the highest recorded score at ${pct(d.top_score)}, while ${d.bottom_name} has the lowest at ${pct(d.bottom_score)}. This range identifies where HR can recognize sustained contribution and where a more detailed coaching conversation may be appropriate after reviewing the underlying evidence.` : 'Key findings. No active performance employee records are available for a high and low comparison.',
      `Data interpretation and strengths. ${currentQueue}. The average score provides a balanced workforce indicator, while completed reviews show that part of the evaluation process has reached a documented conclusion. Consistent completion of remaining reviews is important because performance evidence informs development and recognition discussions.`,
      `Areas requiring attention and recommended HR actions. Active review workflows represent outstanding evaluation activity that should be closed in the correct sequence. ${action} HR may consider coaching or targeted development planning for lower recorded scores only after validating role expectations, context, and manager feedback.`,
    ])],
    competency: [report('Competency Management Report', [
      `Workforce overview. ${n(m.employee_count)} active employee records have an average competency score of ${pct(m.average_score)}, and ${active} competency workflow(s) are currently active. This provides a current indicator of workforce capability and development activity.`,
      `Key findings. ${currentQueue}. The average competency score is most useful when considered alongside the workflow queue, because open development activity indicates that capability records are still being reviewed or updated.`,
      'Data interpretation and strengths. The recorded competency average reflects the organization’s present capability level across the included employees. Active development workflows are a positive sign that capability development is being managed through an accountable process rather than left informal.',
      `Areas requiring attention and recommended HR actions. The active queue should be reviewed to confirm that development plans align with the competency evidence already recorded. ${action} HR should prioritize learning or coaching discussions for records that require competency review, while retaining manager judgment over the final development action.`,
    ])],
    learning: [report('Learning Management Report', [
      `Workforce overview. Learning progress averages ${pct(m.average_score)} across ${n(m.employee_count)} active employee records, and ${n(m.completed_count)} record(s) have reached 100% learning progress. These values show the current level of learning completion across the monitored population.`,
      `Key findings. ${currentQueue}. Completed learning records demonstrate that some employees have met the recorded learning target, while the difference between the average progress and full completion identifies remaining development activity for HR and managers to monitor.`,
      'Data interpretation and strengths. The completion count provides evidence of achieved learning progress, and the active workflow queue shows that learning is being managed through assigned stages. Maintaining follow-through on incomplete records supports consistent capability development.',
      `Areas requiring attention and recommended HR actions. Records below full completion warrant a review of their current learning workflow stage and any related support needs. ${action} HR should use the recorded learning progress when planning next learning activities, with individual requirements confirmed through the normal review process.`,
    ])],
    training: [report('Training Management Report', [
      `Workforce overview. Training activity includes ${n(m.active_count)} active and ${n(m.completed_count)} completed training workflow(s). ${n(m.scheduled_count)} training workflow(s) have a confirmed schedule, showing the portion of activity that has progressed to planned delivery.`,
      `Key findings. ${currentQueue}. The relationship between scheduled, active, and completed workflows provides an implementation view: scheduled activity is prepared for delivery, while completed workflows indicate training processes that have reached their recorded endpoint.`,
      'Data interpretation and strengths. Confirmed schedules support operational planning and give managers a basis for coordinating participation. Completed workflows show that some training activity has been carried through the current process.',
      `Areas requiring attention and recommended HR actions. Active workflows should be reviewed so that the next required training stage is documented without delay. ${action} HR should assess training outcomes through the evidence available in each workflow before deciding whether additional delivery or follow-up is needed.`,
    ])],
    succession: [report('Succession Planning Report', [
      `Workforce overview. ${n(m.candidate_count)} succession profile(s) have an average readiness score of ${pct(m.average_readiness)}. The current distribution is ${n(m.ready_now_count)} Ready Now, ${n(m.ready_later_count)} Ready in 1–2 years, and ${n(m.development_count)} Development Needed profile(s).`,
      `Key findings. ${currentQueue}. The readiness distribution provides a view of near-term and longer-term talent availability, with Ready Now profiles representing the strongest immediate pipeline indicator in the analyzed records.`,
      'Data interpretation and strengths. The presence of Ready Now and Ready in 1–2 years profiles indicates that succession readiness is being assessed across more than one time horizon. Development Needed profiles identify where focused capability building may be relevant before future succession consideration.',
      `Areas requiring attention and recommended HR actions. HR should review profiles in the Development Needed category alongside the active succession queue to determine where development discussions should be prioritized. ${action} Final successor decisions should remain with the authorized reviewers after considering the full candidate evidence.`,
    ])],
    recognition: [report('Social Recognition Report', [
      `Workforce overview. Recognition activity includes ${active} active and ${n(m.completed_count)} completed recognition workflow(s). This provides a current view of nominations or recognition records moving through the organization’s review process.`,
      d.top_name ? `Key findings. ${d.top_name} is linked to ${n(d.top_count)} recognition workflow(s), the highest recorded count in the analyzed recognition records. This indicates the greatest recorded recognition activity for an individual, while final recognition quality remains subject to the established review process.` : 'Key findings. No employee-level recognition comparison is available from the current recognition records.',
      `Data interpretation and strengths. ${currentQueue}. Completed recognition workflows demonstrate that recognition activity can reach a documented outcome, while active records show that recognition remains under review rather than being decided automatically.`,
      `Areas requiring attention and recommended HR actions. The active queue should be reviewed promptly so valid nominations receive timely validation and feedback. ${action} HR may consider recognition for eligible employees only after reviewing the documented achievement and approval evidence.`,
    ])],
  }
  return reports[moduleWorkflow.module]
}

function dashboardInsights({ workforce = {}, departments = [], activeWorkflows = [], succession = {}, recognition = {}, employee }) {
  if (employee) return [report('Employee HR Analytics Report', [
    `Workforce overview. ${employee.full_name} has recorded performance of ${pct(employee.performance_score)}, competency of ${pct(employee.competency_score)}, and learning progress of ${pct(employee.learning_progress)}.`,
    'Key findings and interpretation. These measures provide a current view of performance, capability, and learning progress. Comparing the three recorded values helps focus discussion on the area with the lowest current result without assuming its cause.',
    'Recommended HR actions. HR and the manager should review the recorded evidence, discuss the employee’s development needs, and use the applicable workflow to document any agreed coaching or learning action.',
  ])]
  const best = departments.reduce((current, row) => !current || n(row.performance) > n(current.performance) ? row : current, null)
  const leading = activeWorkflows[0]
  return [report('Executive HR Analytics Report', [
    `Workforce overview. ${n(workforce.employee_count)} active employee records show average performance of ${pct(workforce.average_performance)}, competency of ${pct(workforce.average_competency)}, and learning progress of ${pct(workforce.learning_completion)}. Together, these values provide a current cross-module picture of workforce performance and development.`,
    `Department and workforce findings. ${best ? `${best.department} has the highest recorded department performance average at ${pct(best.performance)} across ${n(best.employees)} employee records.` : 'Department performance records are not available.'} The organization also has ${n(succession.ready_now_count)} Ready Now succession profile(s) and ${n(recognition.completed_count)} completed recognition workflow(s), which are current indicators of talent readiness and recognition delivery.`,
    `Data interpretation and organizational strengths. The relationship among performance, competency, and learning averages helps HR assess whether workforce development is broadly aligned. ${leading ? `${n(leading.count)} active workflow(s) are currently at ${leading.current_stage.replaceAll('_', ' ')}, making it the largest active queue for review.` : 'No active workflow queue is currently recorded.'} Completed recognition workflows and Ready Now profiles are positive indicators of formal people processes being carried through.`,
    'Areas requiring attention. The largest active workflow queue should be reviewed because unresolved stages can delay performance, learning, training, succession, or recognition activity. Workforce averages should be interpreted with department and employee evidence before identifying any individual development priorities.',
    `Executive HR recommendations. ${leading ? `Prioritize review of the ${leading.current_stage.replaceAll('_', ' ')} queue, then use department and workforce metrics to guide coaching, learning, competency, succession, and recognition discussions.` : 'Use the current workforce and department metrics to prioritize the next HR review cycle.'} Recommendations should be validated by authorized HR and management reviewers before action is taken.`,
  ])]
}

// ----------------------- LLM prompt construction ----------------------------

function serializeContext(context) {
  return JSON.stringify(context, null, 2)
}

const MODULE_SECTIONS = {
  performance: ['Overall Performance Summary', 'KPI Analysis', 'Strengths', 'Areas Needing Improvement', 'Coaching Recommendations', 'Performance Trend', 'Readiness Score'],
  competency: ['Competency Summary', 'Missing Competencies', 'Skill Gap Analysis', 'Priority Skills', 'Development Recommendations', 'Readiness Assessment'],
  learning: ['Completion Analysis', 'Learning Engagement', 'Weak Learning Areas', 'Learning Effectiveness', 'Suggested Next Courses'],
  training: ['Attendance Analysis', 'Completion Rate', 'Training Effectiveness', 'Participants Needing Follow-up', 'Recommended Future Trainings'],
  succession: ['Readiness Summary', 'Leadership Potential', 'Successor Ranking', 'Risk Analysis', 'Development Recommendations'],
  recognition: ['Recognition Trends', 'Frequently Recognized Employees', 'Team Engagement', 'Employees Needing Recognition', 'Recognition Distribution'],
}

const EXECUTIVE_SECTIONS = ['Workforce Overview', 'Department Analysis', 'Performance Analysis', 'Competency Analysis', 'Learning Analysis', 'Training Analysis', 'Succession Readiness', 'Recognition Analysis', 'Organizational Strengths', 'Areas Requiring Attention', 'Executive Recommendations']

function buildPrompt(context) {
  if (context.moduleWorkflow) {
    const moduleLabel = context.moduleWorkflow.module
    const stage = context.moduleWorkflow.stage
    const sections = MODULE_SECTIONS[moduleLabel] || ['Overview', 'Analysis', 'Strengths', 'Areas Requiring Attention', 'Recommendations']
    return {
      system: 'You are an expert HR workforce analytics assistant for a hospitality organization. You analyze live workforce database values and produce evidence-based, structured HR management reports.',
      user: `Generate an HR analytics report for the "${moduleLabel}" module at stage "${stage}". Use only the data provided below; do not invent values.

Use this exact structure with Markdown headings:
# ${moduleLabel[0].toUpperCase()}${moduleLabel.slice(1)} Management Report
${sections.map(s => `## ${s}`).join('\n')}

Rules:
- Base every claim strictly on the provided data and actual numbers.
- Interpret relationships between metrics rather than only listing numbers — explain what score gaps mean, how completed vs active records relate, and what the data implies for action.
- Explain the meaning of each metric in professional HR language.
- If a dataset has no records, explicitly state that insufficient records exist for that area.
- Recommendations must be grounded in the calculated metrics.
- Keep the report under 450 words.

Here is the current database context (JSON):
${serializeContext(context)}`,
    }
  }
  if (context.employee) {
    return {
      system: 'You are an expert HR workforce analytics assistant for a hospitality organization. You produce concise, evidence-based employee analytics reports.',
      user: `Generate a concise employee HR analytics report for ${context.employee.full_name}. Use only the provided data; do not invent values.

Use this structure with Markdown headings:
# <Report Title>
## Overview
## Analysis
## Strengths
## Areas Requiring Attention
## Recommendations

Interpret the relationships between the employee's performance, competency, and learning metrics rather than only restating them. Base every claim strictly on the provided data. Explain metric meaning, and if a metric has no data, explicitly state that insufficient records exist. Keep the report under 350 words.

Here is the employee context (JSON):
${serializeContext(context.employee)}`,
    }
  }
  return {
    system: 'You are an expert HR workforce analytics assistant for a hospitality organization. You analyze live workforce database values and produce structured, evidence-based executive workforce analytics reports.',
    user: `Generate an Executive Workforce Analytics Report for the organization. Use only data provided below; do not invent values.

Use this exact structure with Markdown headings:
# Executive Workforce Analytics Report
${EXECUTIVE_SECTIONS.map(s => `## ${s}`).join('\n')}

Rules:
- Base every claim strictly on the provided data and actual numbers.
- Interpret relationships between metrics across modules rather than only reporting numbers — explain how performance compares to competency, how learning completion relates to capability, and how active workflow queues affect readiness.
- Explain the meaning of each metric in professional HR language.
- If a dataset has no records, explicitly state that insufficient records exist for that area.
- Recommendations must be grounded in the calculated metrics.
- Keep the report under 600 words.

Here is the current workforce context (JSON):
${serializeContext(context)}`,
  }
}

// --------------------------- OpenRouter client ------------------------------

async function callOpenRouter(context) {
  const { system, user } = buildPrompt(context)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'HTTP-Referer': config.clientOrigin,
      'X-Title': 'PerDevSys',
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenRouter request failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter returned an empty response.')
  return content
}

// Take raw LLM Markdown and normalize it into the [{ title, summary }] shape the UI expects.
function normalize(content, fallbackTitle) {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1]?.trim() || fallbackTitle
  return [{ title, summary: content.trim() }]
}

// ------------------------------ Public API ----------------------------------

/**
 * Generate analytics insights.
 *
 * @param {object} context - Context object assembled by the analytics route.
 * @returns {Promise<Array<{title: string, summary: string}>>} Insights array.
 */
export async function generateInsights(context) {
  // If no OpenRouter API key is configured, use the deterministic template
  // reports so the application continues to work offline / in demos.
  if (!config.openRouterApiKey) {
    return context.moduleWorkflow ? moduleInsights(context) : dashboardInsights(context)
  }

  try {
    const fallbackTitle = context.moduleWorkflow
      ? `${context.moduleWorkflow.module[0].toUpperCase()}${context.moduleWorkflow.module.slice(1)} Management Report`
      : context.employee
        ? 'Employee HR Analytics Report'
        : 'Executive HR Analytics Report'
    const content = await callOpenRouter(context)
    return normalize(content, fallbackTitle)
  } catch (error) {
    // Graceful degradation: fall back to the template report so the UI never
    // breaks when the LLM service is unavailable.
    console.warn('[openrouter] Falling back to template insights:', error.message)
    return context.moduleWorkflow ? moduleInsights(context) : dashboardInsights(context)
  }
}

