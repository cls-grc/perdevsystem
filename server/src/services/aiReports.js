import { query, transaction } from '../db.js'
import { config } from '../config.js'
import { generateInsights } from './openrouter.js'

// ---------------------------------------------------------------------------
// AI report orchestration.
//
// Each function is deliberately separated so it can be reused independently:
//   - calculateMetrics()  computes the module / executive metrics from the DB
//   - buildSummary()      builds a deterministic summary from those metrics
//   - generateAI()        calls the LLM (falls back to buildSummary on failure)
//   - saveReport()        persists the report + links it to the workflow audit
//
// AI generation is non-blocking best-effort: a failure never prevents a
// workflow from completing. Metrics are always saved so a report can be
// generated (or regenerated) later.
// ---------------------------------------------------------------------------

const n = value => Math.round(Number(value || 0))

// ------------------------- Metric queries by module -------------------------

const MODULE_METRIC_QUERIES = {
  performance: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(performance_score))::int,0) AS average_score,
    (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='active') AS active_count,
    (SELECT count(*)::int FROM workflows WHERE module='performance' AND status='completed') AS completed_count
    FROM employees WHERE is_active=true`,
  competency: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(competency_score))::int,0) AS average_score,
    (SELECT count(*)::int FROM workflows WHERE module='competency' AND status='active') AS active_count,
    (SELECT count(*)::int FROM workflows WHERE module='competency' AND status='completed') AS completed_count
    FROM employees WHERE is_active=true`,
  learning: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(learning_progress))::int,0) AS average_score,
    count(*) FILTER (WHERE learning_progress>=100)::int AS completed_count
    FROM employees WHERE is_active=true`,
  training: `SELECT count(*) FILTER (WHERE w.status='active')::int AS active_count,
    count(*) FILTER (WHERE w.status='completed')::int AS completed_count
    FROM workflows w WHERE w.module='training'`,
  succession: `SELECT count(*)::int AS candidate_count,
    coalesce(round(avg(readiness_score))::int,0) AS average_readiness,
    count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count,
    count(*) FILTER (WHERE readiness_band='ready_in_1_2_years')::int AS ready_later_count,
    count(*) FILTER (WHERE readiness_band='development_needed')::int AS development_count
    FROM succession_profiles`,
  recognition: `SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count,
    (SELECT count(*)::int FROM workflows WHERE module='recognition' AND status='active') AS active_count
    FROM workflows WHERE module='recognition'`,
}

const EXECUTIVE_METRIC_QUERIES = {
  workforce: `SELECT count(*)::int AS employee_count,
    coalesce(round(avg(performance_score))::int,0) AS average_performance,
    coalesce(round(avg(competency_score))::int,0) AS average_competency,
    coalesce(round(avg(learning_progress))::int,0) AS learning_completion
    FROM employees WHERE is_active=true`,
  departments: `SELECT department, count(*)::int AS employees,
    coalesce(round(avg(performance_score))::int,0) AS performance,
    coalesce(round(avg(competency_score))::int,0) AS competency,
    coalesce(round(avg(learning_progress))::int,0) AS learning
    FROM employees WHERE is_active=true GROUP BY department ORDER BY department`,
  workflows: `SELECT module, current_stage, count(*)::int AS count
    FROM workflows WHERE status='active' GROUP BY module, current_stage ORDER BY module`,
  succession: `SELECT count(*)::int AS candidate_count,
    count(*) FILTER (WHERE readiness_band='ready_now')::int AS ready_now_count,
    count(*) FILTER (WHERE readiness_band='ready_in_1_2_years')::int AS ready_later_count,
    count(*) FILTER (WHERE readiness_band='development_needed')::int AS development_count
    FROM succession_profiles`,
  recognition: `SELECT count(*) FILTER (WHERE status='completed')::int AS completed_count,
    count(*) FILTER (WHERE status='active')::int AS active_count
    FROM workflows WHERE module='recognition'`,
  training: `SELECT count(*) FILTER (WHERE w.status='completed')::int AS completed_count,
    count(*) FILTER (WHERE w.status='active')::int AS active_count
    FROM workflows w WHERE w.module='training'`,
}

// ---------------------------- Metric calculation ----------------------------

const pct = value => `${n(value)}%`

// --------------------- Data context / completeness -------------------------

// Which datasets each module report is based on, and the metric key that holds
// its record count. Used to compute the confidence indicator and to state
// explicitly which datasets were analyzed (and which have no records yet).
const MODULE_DATA_CONTEXT = {
  performance: [
    ['Employee performance records', 'employee_count'],
    ['Completed performance reviews', 'completed_count'],
    ['Active performance reviews', 'active_count'],
  ],
  competency: [
    ['Employee competency records', 'employee_count'],
    ['Active development workflows', 'active_count'],
  ],
  learning: [
    ['Employee learning records', 'employee_count'],
    ['Completed learning paths', 'completed_count'],
  ],
  training: [
    ['Completed training workflows', 'completed_count'],
    ['Active training workflows', 'active_count'],
  ],
  succession: [
    ['Succession profiles', 'candidate_count'],
  ],
  recognition: [
    ['Completed recognition records', 'completed_count'],
    ['Active recognition workflows', 'active_count'],
  ],
}

function computeDataContext(module, metrics) {
  const datasets = []
  const missing = []
  let covered = 0
  let total = 0

  const add = (label, count) => {
    const c = Number(count || 0)
    datasets.push({ label, count: c })
    total++
    if (c > 0) covered++
    else missing.push(label)
  }

  if (module === 'executive') {
    add('Employee records', metrics.workforce?.employee_count)
    add('Departments analyzed', metrics.departments?.length)
    add('Active workflows', (metrics.activeWorkflows || []).reduce((s, r) => s + Number(r.count || 0), 0))
    add('Succession profiles', metrics.succession?.candidate_count)
    add('Completed recognition records', metrics.recognition?.completed_count)
    add('Completed training workflows', metrics.training?.completed_count)
  } else {
    for (const [label, key] of (MODULE_DATA_CONTEXT[module] || [])) {
      add(label, metrics[key])
    }
  }

  const confidence = total === 0 ? 0 : Math.round((covered / total) * 100)
  const completeness = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'
  return { datasets, missing, confidence, completeness }
}

function datasetsSection(dataContext) {
  const body = dataContext.datasets.length
    ? dataContext.datasets.map(d => `- **${d.label}**: ${n(d.count)} record(s)${d.count === 0 ? ' — no records yet' : ''}`).join('\n')
    : 'No datasets were available for analysis.'
  return { heading: 'Datasets Analyzed', body }
}

function dataCompletenessSection(dataContext) {
  const populated = dataContext.datasets.filter(d => d.count > 0).length
  const total = dataContext.datasets.length
  const missingText = dataContext.missing.length
    ? `The following dataset(s) currently have no records: **${dataContext.missing.join(', ')}**. ${total === 1 ? 'This section is based on no confirmed data.' : 'Recommendations are grounded only in the populated datasets.'}`
    : 'All analyzed datasets contain records, so the findings below are based on confirmed data.'
  const body = `This report is based on **${populated} of ${total}** analyzed dataset(s). Confidence in the findings is **${dataContext.completeness}** (${dataContext.confidence}%). ${missingText}`
  return { heading: 'Data Completeness & Confidence', body }
}

function buildPerformanceSections(metrics, details = {}) {
  const sections = []
  const avg = pct(metrics.average_score)
  const completed = n(metrics.completed_count || 0)
  const active = n(metrics.active_count || 0)
  const employees = n(metrics.employee_count || 0)
  sections.push({ heading: 'Overall Performance Summary', body: `The performance review population includes **${employees}** active employee records with an average performance score of **${avg}**. There are **${completed}** completed reviews and **${active}** active review workflows. This means review coverage is ${active > 0 ? 'still in progress' : 'fully documented'}, and the average score reflects ${employees > 0 ? 'the whole recorded population' : 'no confirmed records yet'}.` })
  sections.push({ heading: 'KPI Analysis', body: `KPI delivery is reflected in the average score of **${avg}**. ${details.top_name ? `The spread between the highest (**${pct(details.top_score)||0}** — ${details.top_name}) and lowest (**${pct(details.bottom_score)||0}** — ${details.bottom_name}) performers indicates where recognition and coaching effort should be concentrated.` : 'Insufficient records exist to compare high and low performers; no KPI delivery gap can be assessed yet.'}` })
  sections.push({ heading: 'Strengths', body: `Completed reviews (**${completed}**) show that evaluation activity has reached a documented conclusion, providing a stable evidence base for development and recognition decisions. ${completed > 0 ? 'A higher completion count relative to active reviews signals disciplined review execution.' : 'No completed reviews are recorded, so strengths cannot yet be confirmed from performance evidence.'}` })
  sections.push({ heading: 'Areas Needing Improvement', body: `Active review workflows (**${active}**) represent outstanding evaluation activity. ${details.bottom_name ? `The gap between top and bottom performers (${pct(details.top_score)||0} vs ${pct(details.bottom_score)||0}) highlights roles that may benefit from targeted coaching after validating role context and manager feedback.` : 'Insufficient records exist to identify specific individuals; the priority is to close open review cycles first.'}` })
  sections.push({ heading: 'Coaching Recommendations', body: `Coaching should target the lowest-scoring band and priority should be proportional to the gap from the workforce average (**${avg}**). Recommendations are derived from the calculated metrics, so focus coaching where the score gap is widest.` })
  sections.push({ heading: 'Performance Trend', body: `The average score (**${avg}**) paired with **${completed}** completed reviews forms the current trend baseline. ${completed < 2 ? 'Additional completed cycles are required to establish a meaningful multi-period trend.' : 'Repeated cycles provide a basis for comparing performance movement over time.'}` })
  sections.push({ heading: 'Readiness Score', body: `Readiness is derived from performance, competency, and learning metrics. The average performance score (**${avg}**) is the single largest contributor to readiness; higher performance correlates with greater readiness for expanded responsibility.` })
  return sections
}

function buildCompetencySections(metrics, details = {}) {
  const sections = []
  const avg = pct(metrics.average_score)
  const employees = n(metrics.employee_count || 0)
  const active = n(metrics.active_count || 0)
  sections.push({ heading: 'Competency Summary', body: `**${employees}** active employee records have an average competency score of **${avg}**. The gap between this average and full proficiency (**100%**) represents the current capability headroom across the workforce.` })
  sections.push({ heading: 'Missing Competencies', body: `With an average of **${avg}**, the workforce is operating below full competency. The shortfall (**${100 - n(metrics.average_score)}** points) indicates competencies that are missing or under-developed and should be the focus of the development plan.` })
  sections.push({ heading: 'Skill Gap Analysis', body: `**${active}** active development workflows show capability records still under review. The relationship between the average score (**${avg}**) and the number of open development workflows reveals whether skill gaps are being actively addressed or left unmanaged.` })
  sections.push({ heading: 'Priority Skills', body: `Prioritize skills tied to the lowest competency scores. The larger the gap from the average (**${avg}**), the higher the priority for a given competency area in the development plan.` })
  sections.push({ heading: 'Development Recommendations', body: `Assign development plans to close the gap between current scores (**${avg}**) and full proficiency. Focus development activity on the **${active}** active workflows to ensure capability building is actively managed.` })
  sections.push({ heading: 'Readiness Assessment', body: `Ready-now readiness increases as competency scores approach full proficiency. The current average (**${avg}**) informs the readiness band: a higher score supports faster succession and delegation readiness.` })
  return sections
}

function buildLearningSections(metrics) {
  const sections = []
  const avg = pct(metrics.average_score)
  const employees = n(metrics.employee_count || 0)
  const completed = n(metrics.completed_count || 0)
  sections.push({ heading: 'Completion Analysis', body: `Learning progress averages **${avg}** across **${employees}** active employee records, with **${completed}** record(s) at full completion. This means ${completed > 0 ? 'a portion of the workforce has reached their learning target while others are still in progress' : 'no employee has reached full completion yet'}.` })
  sections.push({ heading: 'Learning Engagement', body: `Engagement is reflected by the average progress (**${avg}**). The gap between this average and full completion (**${completed}** records at 100%) shows how much learning activity remains and where engagement is lowest.` })
  sections.push({ heading: 'Weak Learning Areas', body: `Records below full completion warrant review of their workflow stage. The difference between the average (**${avg}**) and the completion target highlights the learning areas that need the most reinforcement.` })
  sections.push({ heading: 'Learning Effectiveness', body: `Completed records (**${completed}**) demonstrate that learning activities can reach completion, supporting the effectiveness of assigned learning paths. Higher completion generally correlates with more effective learning design.` })
  sections.push({ heading: 'Suggested Next Courses', body: `Recommend next courses based on the gap between current progress (**${avg}**) and the completion target. Learners furthest from completion should be prioritized for the next relevant course in their path.` })
  return sections
}

function buildTrainingSections(metrics) {
  const sections = []
  const active = n(metrics.active_count || 0)
  const completed = n(metrics.completed_count || 0)
  const total = active + completed
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  sections.push({ heading: 'Attendance Analysis', body: `Training activity includes **${active}** active and **${completed}** completed training workflows. Attendance execution is ${active > 0 ? 'still ongoing for some sessions' : 'complete for all recorded sessions'}.` })
  sections.push({ heading: 'Completion Rate', body: `The completion rate is **${rate}%** (**${completed}** of **${total}** training workflows). ${total > 0 ? 'This reflects how much of the training pipeline has reached its documented endpoint.' : 'No training workflows are recorded, so a completion rate cannot yet be computed.'}` })
  sections.push({ heading: 'Training Effectiveness', body: `Completed training workflows (**${completed}**) represent training that reached its documented endpoint. A higher completion rate (**${rate}%**) indicates more effective training delivery and participant follow-through.` })
  sections.push({ heading: 'Participants Needing Follow-up', body: `Active training workflows (**${active}**) identify participants or sessions requiring follow-up to reach completion. These should be prioritized to improve the overall completion rate.` })
  sections.push({ heading: 'Recommended Future Trainings', body: `Recommend future training based on recorded completion (**${completed}**) and outstanding active sessions (**${active}**), prioritizing areas with incomplete delivery to raise the completion rate.` })
  return sections
}

function buildSuccessionSections(metrics) {
  const sections = []
  const candidates = n(metrics.candidate_count || 0)
  const avg = pct(metrics.average_readiness)
  const readyNow = n(metrics.ready_now_count || 0)
  const readyLater = n(metrics.ready_later_count || 0)
  const development = n(metrics.development_count || 0)
  sections.push({ heading: 'Readiness Summary', body: `**${candidates}** succession profile(s) have an average readiness score of **${avg}**. The distribution (${readyNow} Ready Now, ${readyLater} Ready in 1–2 years, ${development} Development Needed) shows the depth of the current leadership pipeline.` })
  sections.push({ heading: 'Leadership Potential', body: `**${readyNow}** profile(s) are Ready Now and **${readyLater}** are Ready in 1–2 years. A higher Ready Now share indicates stronger immediate leadership potential; a larger Ready in 1–2 years cohort signals pipeline depth for the medium term.` })
  sections.push({ heading: 'Successor Ranking', body: `Profiles in the Ready Now band (**${readyNow}**) rank highest for immediate succession, followed by the Ready in 1–2 years cohort (**${readyLater}**). Ranking is driven by the calculated readiness score, not by judgment alone.` })
  sections.push({ heading: 'Risk Analysis', body: `**${development}** profile(s) are in the Development Needed category — the primary succession risk. The higher this count relative to Ready Now profiles, the greater the exposure to leadership gaps for critical roles.` })
  sections.push({ heading: 'Development Recommendations', body: `Prioritize development for the **${development}** Development Needed profile(s) to build near-term pipeline depth. The goal is to move profiles toward Ready Now, balancing the current **${readyNow}**-strong immediate cohort.` })
  return sections
}

function buildRecognitionSections(metrics, details = {}) {
  const sections = []
  const completed = n(metrics.completed_count || 0)
  const active = n(metrics.active_count || 0)
  sections.push({ heading: 'Recognition Trends', body: `Recognition activity includes **${completed}** completed and **${active}** active recognition workflow(s). The completed-to-active ratio shows whether recognition is being delivered promptly or accumulating in review.` })
  sections.push({ heading: 'Frequently Recognized Employees', body: details.top_name ? `**${details.top_name}** is linked to **${n(details.top_count)}** recognition workflow(s), the highest recorded count. Recognized employees clustered at the top indicate which behaviors are being celebrated most.` : 'Insufficient records exist to identify frequently recognized employees; no recognition distribution can yet be assessed.' })
  sections.push({ heading: 'Team Engagement', body: `Recognition participation is reflected in the **${completed}** completed nominations. ${completed > 0 ? 'Higher completed counts indicate stronger engagement with the recognition process.' : 'No completed nominations are recorded, so team engagement with recognition cannot yet be confirmed.'}` })
  sections.push({ heading: 'Employees Needing Recognition', body: `Active recognition workflows (**${active}**) represent nominations still under review. Eligible employees may benefit from timely validation, and clearing the queue can improve recognition responsiveness.` })
  sections.push({ heading: 'Recognition Distribution', body: `Completed recognition workflows (**${completed}**) show recognition distributed across the organization. The mix of completed and active records (**${active}**) illustrates how evenly recognition is being spread over time.` })
  return sections
}

const MODULE_BUILDERS = {
  performance: buildPerformanceSections,
  competency: buildCompetencySections,
  learning: buildLearningSections,
  training: buildTrainingSections,
  succession: buildSuccessionSections,
  recognition: buildRecognitionSections,
}

function buildExecutiveSections(metrics) {
  const m = metrics
  const sections = []
  const perf = pct(m.workforce.average_performance)
  const comp = pct(m.workforce.average_competency)
  const learn = pct(m.workforce.learning_completion)
  sections.push({ heading: 'Workforce Overview', body: `The organization has **${n(m.workforce.employee_count)}** active employee records with an average performance score of **${perf}**, average competency of **${comp}**, and learning completion of **${learn}**. The relationship among these three averages reveals whether capability development is keeping pace with performance expectations.` })
  sections.push({ heading: 'Department Analysis', body: m.departments.length ? m.departments.map(d => `- **${d.department}**: ${n(d.employees)} employee(s), performance **${pct(d.performance)}**, competency **${pct(d.competency)}**, learning **${pct(d.learning)}**.`).join('\n') + '\n\nDepartments with lower performance than their competency may need better role alignment; lower competency than learning suggests learning is not yet translating into capability.' : 'Insufficient records exist to analyze departments; no departmental comparison can yet be drawn.' })
  sections.push({ heading: 'Performance Analysis', body: `Average performance is **${perf}**. Compared with competency (**${comp}**), a performance score below competency indicates the workforce may not be fully applying its capabilities, while performance above competency suggests capacity may be under challenge.` })
  sections.push({ heading: 'Competency Analysis', body: `Average competency is **${comp}**. The gap to full proficiency (**${100 - n(m.workforce.average_competency)}** points) defines the capability-building opportunity that training and learning should target.` })
  sections.push({ heading: 'Learning Analysis', body: `Average learning completion is **${learn}**. Where learning completion trails competency, employees are acquiring knowledge faster than it is being converted into verified capability.` })
  sections.push({ heading: 'Training Analysis', body: `Training activity includes **${n(m.training.completed_count)}** completed and **${n(m.training.active_count)}** active training workflows. The completion ratio indicates how much of the training pipeline has reached delivery maturity.` })
  sections.push({ heading: 'Succession Readiness', body: `**${n(m.succession.ready_now_count)}** profile(s) are Ready Now, **${n(m.succession.ready_later_count)}** Ready in 1–2 years, and **${n(m.succession.development_count)}** Development Needed. The balance across these bands shows the organization's resilience to key-role turnover.` })
  sections.push({ heading: 'Recognition Analysis', body: `Recognition activity includes **${n(m.recognition.completed_count)}** completed and **${n(m.recognition.active_count)}** active recognition workflow(s). Strong recognition completion relative to activity signals a healthy culture of acknowledgement.` })
  sections.push({ heading: 'Organizational Strengths', body: `Completed training and recognition workflows, together with Ready Now succession profiles, indicate that formal people processes are being carried through to documented outcomes. These reflect operational discipline in people management.` })
  sections.push({ heading: 'Areas Requiring Attention', body: m.activeWorkflows.length ? `The largest active workflow queue is at **${m.activeWorkflows[0].current_stage.replaceAll('_', ' ')}** with **${n(m.activeWorkflows[0].count)}** record(s). Resolving these stages can reduce delays across performance, learning, training, succession, and recognition.` : 'No active workflow queue is currently recorded; the focus should be on sustaining the documented processes.' })
  sections.push({ heading: 'Executive Recommendations', body: `Prioritize closing the largest active workflow queues and target the widest competency gap (**${100 - n(m.workforce.average_competency)}** points). Where performance trails competency, realign roles or expectations; where learning trails competency, convert learning into applied capability. Recommendations should be validated by authorized reviewers.` })
  return sections
}

// ------------------------------ Summary builder -----------------------------

function buildSummary(module, metrics, details = {}) {
  const title = module === 'executive'
    ? 'Executive Workforce Analytics Report'
    : `${module[0].toUpperCase()}${module.slice(1)} Management Report`
  const dataContext = computeDataContext(module, metrics)
  const sections = module === 'executive'
    ? buildExecutiveSections(metrics)
    : MODULE_BUILDERS[module](metrics, details)
  // Prepend the data-transparency sections so the user always sees which
  // datasets were analyzed and how confident the report is in its findings.
  const allSections = [dataCompletenessSection(dataContext), datasetsSection(dataContext), ...sections]
  const summary = allSections.map(s => `## ${s.heading}\n${s.body}`).join('\n\n')
  return { title, summary, sections: allSections, dataContext }
}

// ------------------------------ Metric queries ------------------------------

export async function calculateMetrics(module, { employeeId = null } = {}) {
  if (module === 'executive') {
    const [workforce, departments, workflows, succession, recognition, training] = await Promise.all([
      query(EXECUTIVE_METRIC_QUERIES.workforce),
      query(EXECUTIVE_METRIC_QUERIES.departments),
      query(EXECUTIVE_METRIC_QUERIES.workflows),
      query(EXECUTIVE_METRIC_QUERIES.succession),
      query(EXECUTIVE_METRIC_QUERIES.recognition),
      query(EXECUTIVE_METRIC_QUERIES.training),
    ])
    const activeWorkflows = workflows.rows.sort((a, b) => Number(b.count) - Number(a.count))
    return {
      workforce: workforce.rows[0],
      departments: departments.rows,
      activeWorkflows,
      succession: succession.rows[0],
      recognition: recognition.rows[0],
      training: training.rows[0],
    }
  }

  const generation = await query(MODULE_METRIC_QUERIES[module])
  const detailsQuery = module === 'performance'
    ? `SELECT (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score DESC NULLS LAST, full_name LIMIT 1) AS top_name,
        (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score DESC NULLS LAST, full_name LIMIT 1) AS top_score,
        (SELECT full_name FROM employees WHERE is_active=true ORDER BY performance_score ASC NULLS LAST, full_name LIMIT 1) AS bottom_name,
        (SELECT performance_score FROM employees WHERE is_active=true ORDER BY performance_score ASC NULLS LAST, full_name LIMIT 1) AS bottom_score`
    : module === 'recognition'
      ? `SELECT e.full_name AS top_name, count(*)::int AS top_count FROM workflows w JOIN employees e ON e.id=w.subject_employee_id WHERE w.module='recognition' GROUP BY e.full_name ORDER BY count(*) DESC NULLS LAST, e.full_name LIMIT 1`
      : `SELECT NULL::text AS top_name`
  const details = await query(detailsQuery)
  return { metrics: generation.rows[0], details: details.rows[0] }
}

// -------------------------------- AI builder --------------------------------

export async function generateAI(module, metrics, details = {}) {
  // Always persist the structured, deterministic summary so the report viewer
  // reliably renders the required module / executive sections. The LLM is used
  // as an optional enrichment of the same evidence-based summary; a failure
  // never blocks report persistence.
  const built = buildSummary(module, metrics, details)
  let content = built.summary
  try {
    const insights = await generateInsights({ moduleWorkflow: { module, stage: 'completed', scope: 'organization-wide' }, moduleMetrics: metrics, moduleDetails: details, executiveMetrics: metrics, dataContext: built.dataContext })
    if (insights[0]?.summary) content = insights[0].summary
  } catch (error) {
    console.warn('[aiReports] LLM enrichment failed, using structured summary:', error.message)
  }
  return { title: built.title, summary: built.summary, content, sections: built.sections, dataContext: built.dataContext }
}

// ------------------------------ Report saving -------------------------------

export async function saveReport(report, { workflowId = null, employeeId = null, module, createdBy = null, scope = 'organization-wide' }) {
  const metricsJson = report.metricsJson || {}
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflowId, module, report.title, report.summary, report.content, JSON.stringify(metricsJson), JSON.stringify(recommendationsJson), scope, employeeId, config.openRouterModel || 'template', '1.0', createdBy],
  )
  return rows[0]
}

export async function saveReportForWorkflow(client, report, workflow, createdBy, metrics) {
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await client.query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflow.id, workflow.module, report.title, report.summary, report.content, JSON.stringify(metrics), JSON.stringify(recommendationsJson), 'organization-wide', workflow.subject_employee_id, config.openRouterModel || 'template', '1.0', createdBy],
  )
  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details, ai_report_id)
     VALUES ($1,$2,'ai_report',$3,$4,$5,$6)`,
    [workflow.id, workflow.current_stage, createdBy, 'AI report generated and saved to the workflow.', { aiReportId: rows[0].id }, rows[0].id],
  )
  return rows[0]
}

// --------------------------- Metric persistence -----------------------------

// Save the calculated module metrics for a completed workflow WITHOUT generating
// an AI report. The UI shows a "Ready to Generate AI Report" state and HR
// generates the report on demand. Metrics are stored so the report can be
// generated or regenerated later using the same calculated values.
export async function saveMetricsForWorkflow(client, workflow, createdBy, metrics) {
  const module = workflow.module
  const title = `${module[0].toUpperCase()}${module.slice(1)} Management Report`
  const built = buildSummary(module, metrics)
  const { rows } = await client.query(
    `INSERT INTO ai_reports (workflow_id, module, title, summary, content, metrics_json, recommendations_json, scope, employee_id, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [workflow.id, module, title, built.summary, built.summary, JSON.stringify(metrics), JSON.stringify([]), 'organization-wide', workflow.subject_employee_id, null, null, createdBy],
  )
  // Record the metrics-only placeholder in the audit trail (no AI report yet).
  await client.query(
    `INSERT INTO workflow_events (workflow_id, stage, event_type, actor_id, note, details, ai_report_id)
     VALUES ($1,$2,'note',$3,$4,$5,$6)`,
    [workflow.id, workflow.current_stage, createdBy, 'Workflow completed. Metrics calculated and saved. AI report ready to generate.', { metricsPreview: true, aiReportId: rows[0].id }, rows[0].id],
  )
  return rows[0]
}

// --------------------------- Combined orchestration -------------------------

// Generate + save a report for a completed workflow. Never throws so workflow
// completion is never blocked by AI failure.
export async function generateAndSaveForWorkflow(client, workflow, createdBy) {
  try {
    const { metrics, details } = await calculateMetrics(workflow.module)
    const report = await generateAI(workflow.module, metrics, details)
    const saved = await saveReportForWorkflow(client, { ...report, metricsJson: metrics }, workflow, createdBy, metrics)
    return { saved: true, reportId: saved.id }
  } catch (error) {
    console.warn('[aiReports] Skipping AI report generation for workflow:', error.message)
    return { saved: false, error: error.message }
  }
}

// Generate an AI report for a workflow using the metrics already saved for it.
// Used by the HR-only on-demand "Generate AI Report" action. Creates a new
// immutable report row; previous reports remain in history.
export async function generateOnDemand(workflowId, createdBy) {
  const { rows } = await query('SELECT * FROM workflows WHERE id=$1', [workflowId])
  const workflow = rows[0]
  if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 })
  if (workflow.status !== 'completed') throw Object.assign(new Error('AI reports can only be generated for completed workflows.'), { status: 409 })

  const { metrics, details } = await calculateMetrics(workflow.module)
  const report = await generateAI(workflow.module, metrics, details)
  const saved = await saveReportForWorkflow({ query }, { ...report, metricsJson: metrics }, workflow, createdBy, metrics)
  return saved
}

export async function saveExecutiveReport(report, createdBy, metrics) {
  const recommendationsJson = (report.sections || []).filter(s => /recommend/i.test(s.heading)).map(s => s.body)
  const { rows } = await query(
    `INSERT INTO ai_reports (module, title, summary, content, metrics_json, recommendations_json, scope, generated_by_model, model_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    ['executive', report.title, report.summary, report.content, JSON.stringify(metrics), JSON.stringify(recommendationsJson), 'organization-wide', config.openRouterModel || 'template', '1.0', createdBy],
  )
  return rows[0]
}

export async function getLatestReports(module, { limit = 1 } = {}) {
  const { rows } = await query(
    `SELECT * FROM ai_reports WHERE module=$1 ORDER BY created_at DESC LIMIT $2`,
    [module, limit],
  )
  return rows
}

export async function getReportsForWorkflow(workflowId) {
  const { rows } = await query(
    `SELECT * FROM ai_reports WHERE workflow_id=$1 ORDER BY created_at DESC`,
    [workflowId],
  )
  return rows
}
