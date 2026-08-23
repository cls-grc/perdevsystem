const SCORE_FIELDS = {
  performance: 'performance_score',
  competency: 'competency_score',
  learning: 'learning_progress',
}

const clampScore = value => {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.min(100, Math.max(0, Math.round(number * 100) / 100))
}

const formFromDetails = details => {
  if (!details || typeof details !== 'object') return {}
  return details.formData && typeof details.formData === 'object' ? details.formData : details
}

const scoreFromKeys = (source, keys) => {
  if (!source || typeof source !== 'object') return null
  for (const key of keys) {
    const score = clampScore(source[key])
    if (score !== null) return score
  }
  return null
}

const average = values => {
  const scores = values.map(clampScore).filter(value => value !== null)
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100
}

const weightedKpiAverage = kpis => {
  const rows = (kpis || [])
    .map(kpi => ({ score: clampScore(kpi?.score), weight: Number(kpi?.weight) }))
    .filter(kpi => kpi.score !== null)
  if (!rows.length) return null
  const totalWeight = rows.reduce((sum, kpi) => sum + (Number.isFinite(kpi.weight) && kpi.weight > 0 ? kpi.weight : 0), 0)
  if (totalWeight > 0) {
    return Math.round((rows.reduce((sum, kpi) => sum + kpi.score * (kpi.weight > 0 ? kpi.weight : 0), 0) / totalWeight) * 100) / 100
  }
  return average(rows.map(kpi => kpi.score))
}

const kpiAverage = form => {
  if (Array.isArray(form?.kpiRatings)) return weightedKpiAverage(form.kpiRatings)
  if (Array.isArray(form?.questions)) return average(form.questions.map(row => Number(row?.rating || 0) * 20))
  const explicit = scoreFromKeys(form, ['overall', 'overallScore', 'averageScore'])
  if (explicit !== null) return explicit
  return null
}

const progressAverage = form => {
  const explicit = scoreFromKeys(form, ['learningProgress', 'progress', 'completion', 'completionRate', 'finalProgress'])
  if (explicit !== null) return explicit
  if (Array.isArray(form)) return average(form.map(row => row?.progress))
  if (Array.isArray(form?.learners)) return average(form.learners.map(row => row?.progress))
  if (Array.isArray(form?.progressRows)) return average(form.progressRows.map(row => row?.progress))
  return null
}

function stageForms(events, finalData = {}) {
  const forms = {}
  for (const event of events || []) {
    forms[event.stage] = formFromDetails(event.details)
  }
  if (finalData && Object.keys(finalData).length) {
    forms.__finalInput = formFromDetails(finalData)
  }
  return forms
}

function derivePerformanceResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const calibration = forms.calibration || {}
  const supervisor = forms.performance_evaluation || {}
  const self = forms.self_assessment || {}
  const finalInput = forms.__finalInput || {}

  const calibratedScore = scoreFromKeys(calibration, ['finalScore', 'calibratedScore', 'approvedScore', 'performanceScore'])
  if (calibratedScore !== null && !/return/i.test(String(calibration.decision || ''))) {
    return { field: SCORE_FIELDS.performance, newValue: calibratedScore, source: 'calibration', calculation: { decision: calibration.decision || null, employeeAvg: calibration.employeeAvg ?? null, supervisorAvg: calibration.deptAvg ?? null } }
  }

  const finalApprovedScore = scoreFromKeys(finalInput, ['finalScore', 'approvedScore', 'calibratedScore', 'performanceScore'])
  if (finalApprovedScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: finalApprovedScore, source: 'final_approval_or_publish', calculation: { submittedAtCompletion: true } }
  }

  const supervisorScore = kpiAverage(supervisor)
  if (supervisorScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: supervisorScore, source: 'performance_evaluation', calculation: { supervisorOverall: supervisorScore } }
  }

  const explicitScore = clampScore(scores?.performanceScore)
  if (explicitScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: explicitScore, source: 'explicit_scores_payload', calculation: {} }
  }

  const selfScore = kpiAverage(self)
  if (selfScore !== null) {
    return { field: SCORE_FIELDS.performance, newValue: selfScore, source: 'self_assessment_fallback', calculation: { selfAssessmentOnly: true } }
  }

  return null
}

function deriveCompetencyResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const updateRecord = forms.update_record || {}
  const trackProgress = forms.track_progress || {}
  const finalInput = forms.__finalInput || {}

  const updateScore = scoreFromKeys(updateRecord, ['newScore', 'competencyScore', 'overallCompetency', 'score', 'finalScore'])
  if (updateScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: updateScore, source: 'update_record', calculation: { recordNotes: updateRecord.reviewNotes || null } }
  }

  const finalScore = scoreFromKeys(finalInput, ['newScore', 'competencyScore', 'overallCompetency', 'score', 'finalScore'])
  if (finalScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: finalScore, source: 'completion_payload', calculation: {} }
  }

  const progressScore = progressAverage(trackProgress)
  if (progressScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: progressScore, source: 'track_progress', calculation: { progressAverage: progressScore } }
  }

  const explicitScore = clampScore(scores?.competencyScore)
  if (explicitScore !== null) {
    return { field: SCORE_FIELDS.competency, newValue: explicitScore, source: 'explicit_scores_payload', calculation: {} }
  }

  return null
}

function deriveLearningResult(events, finalData, scores) {
  const forms = stageForms(events, finalData)
  const assessment = forms.assessment || {}
  const finalInput = forms.__finalInput || {}

  const assessmentProgress = progressAverage(assessment)
  if (assessmentProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: assessmentProgress, source: 'assessment', calculation: { progressAverage: assessmentProgress } }
  }

  const finalProgress = progressAverage(finalInput)
  if (finalProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: finalProgress, source: 'completion_payload', calculation: {} }
  }

  const explicitProgress = clampScore(scores?.learningProgress)
  if (explicitProgress !== null) {
    return { field: SCORE_FIELDS.learning, newValue: explicitProgress, source: 'explicit_scores_payload', calculation: {} }
  }

  return { field: SCORE_FIELDS.learning, newValue: 100, source: 'workflow_completed_default', calculation: { completedLearningWorkflow: true } }
}

export function deriveWorkflowScoreResult(workflow, events, finalData = {}, scores = null) {
  if (!workflow?.subject_employee_id) return null
  if (workflow.module === 'performance') return derivePerformanceResult(events, finalData, scores)
  if (workflow.module === 'competency') return deriveCompetencyResult(events, finalData, scores)
  if (workflow.module === 'learning') return deriveLearningResult(events, finalData, scores)
  return null
}

export async function applyWorkflowScoreWriteBack(client, workflow, events, finalData, scores, actorId) {
  const result = deriveWorkflowScoreResult(workflow, events, finalData, scores)
  if (!result) {
    if (['performance', 'competency', 'learning'].includes(workflow.module) && workflow.subject_employee_id) {
      throw Object.assign(new Error(`Cannot complete ${workflow.module} workflow because no final employee score could be calculated.`), { status: 400 })
    }
    return { scoreWriteBack: null, employee: null }
  }

  const employeeBefore = await client.query(
    `SELECT id, full_name, performance_score, competency_score, learning_progress
     FROM employees WHERE id=$1 AND is_active=true FOR UPDATE`,
    [workflow.subject_employee_id],
  )
  const employee = employeeBefore.rows[0]
  if (!employee) throw Object.assign(new Error('Employee not found or inactive; workflow completion cannot update employee scores.'), { status: 404 })

  const previousValue = Number(employee[result.field] || 0)
  const updated = await client.query(
    `UPDATE employees SET ${result.field}=$1, updated_at=NOW()
     WHERE id=$2
     RETURNING id, employee_number, full_name, department, job_title, performance_score, competency_score, learning_progress, updated_at`,
    [result.newValue, workflow.subject_employee_id],
  )

  if (workflow.module === 'competency') {
    await upsertCompetencyAssessments(client, workflow.subject_employee_id, events, finalData, result.newValue)
  }

  if (workflow.module === 'learning') {
    await markLearningAssignmentsComplete(client, workflow.subject_employee_id)
    await applyGapLearningCompetencyLift(client, workflow, finalData)
  }

  return {
    employee: updated.rows[0],
    scoreWriteBack: {
      employeeId: workflow.subject_employee_id,
      workflowId: workflow.id,
      module: workflow.module,
      field: result.field,
      previousValue,
      newValue: result.newValue,
      source: result.source,
      calculation: result.calculation,
      actorId,
      completedAt: new Date().toISOString(),
    },
  }
}

async function upsertCompetencyAssessments(client, employeeId, events, finalData, aggregateScore) {
  const forms = stageForms(events, finalData)
  const requirements = forms.define_requirements
  const rows = Array.isArray(requirements) ? requirements : []
  for (const row of rows) {
    const competency = row?.competency || row?.name
    if (!competency) continue
    await client.query(
      `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
       VALUES ($1,$2,$3,$4,'assessment')
       ON CONFLICT (employee_id, competency)
       DO UPDATE SET score=EXCLUDED.score, required_score=EXCLUDED.required_score, source='assessment', assessed_at=NOW(), updated_at=NOW()`,
      [employeeId, competency, aggregateScore, clampScore(row.required_score || row.requiredScore || row.target) || 80],
    )
  }
}

async function markLearningAssignmentsComplete(client, employeeId) {
  await client.query(
    `UPDATE learning_assignments
     SET progress=100, status='completed'
     WHERE employee_id=$1 AND (progress < 100 OR status <> 'completed')`,
    [employeeId],
  )
}

async function applyGapLearningCompetencyLift(client, workflow, finalData) {
  const form = formFromDetails(finalData)
  if (!workflow.metadata?.assignedFromCompetencyGap && !form?.assignedFromCompetencyGap) return
  await client.query(
    'UPDATE employees SET competency_score = LEAST(100, competency_score + 10), updated_at = NOW() WHERE id = $1',
    [workflow.subject_employee_id],
  )
  const gapCompetency = workflow.metadata?.competencyName || form?.competencyName
  if (!gapCompetency) return
  await client.query(
    `INSERT INTO competency_assessments (employee_id, competency, score, required_score, source)
     VALUES ($1, $2,
       LEAST(100, COALESCE((SELECT score FROM competency_assessments WHERE employee_id=$1 AND competency=$2), 60) + 10),
       COALESCE((SELECT required_score FROM competency_assessments WHERE employee_id=$1 AND competency=$2), 80),
       'learning_completion')
     ON CONFLICT (employee_id, competency)
     DO UPDATE SET score = LEAST(100, competency_assessments.score + 10),
                    source = 'learning_completion',
                    assessed_at = NOW(),
                    updated_at = NOW()`,
    [workflow.subject_employee_id, gapCompetency],
  )
}
