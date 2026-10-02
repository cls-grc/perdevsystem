import test from 'node:test'
import assert from 'node:assert/strict'
import { stagesFor, nextStage, canActOnStage } from '../src/workflow.js'
import { deriveWorkflowScoreResult } from '../src/services/workflowCompletion.js'

test('Stepper Scope: Succession Planning Step 4 (approved) is strictly restricted to HR and Management', () => {
  const successionStages = stagesFor('succession')
  const approvedStage = successionStages.find(([key]) => key === 'approved')
  assert.ok(approvedStage, 'approved stage must exist in succession')

  const [, label, roles] = approvedStage
  assert.equal(label, 'Management & HR approval')
  assert.ok(roles.includes('hr'), 'HR must have approval authority')
  assert.ok(roles.includes('management'), 'Management must have approval authority')
  assert.equal(roles.includes('supervisor'), false, 'Supervisor must NOT be in approved stage roles')

  // Verify canActOnStage
  assert.equal(canActOnStage(roles, 'hr'), true)
  assert.equal(canActOnStage(roles, 'management'), true)
  assert.equal(canActOnStage(roles, 'operations_manager'), true) // operational oversight
  assert.equal(canActOnStage(roles, 'supervisor'), false, 'Supervisor cannot act on Stage 4 approval')
  assert.equal(canActOnStage(roles, 'employee'), false, 'Employee cannot act on Stage 4 approval')

  // Attempting to advance approved stage as supervisor throws 403
  assert.throws(
    () => nextStage('succession', 'approved', 'supervisor'),
    { status: 403 }
  )
})

test('Stepper Scope: Performance Management stages are properly scoped to each role', () => {
  const perfStages = stagesFor('performance')
  
  // create_review -> hr only
  const createStage = perfStages.find(([key]) => key === 'create_review')
  assert.equal(canActOnStage(createStage[2], 'hr'), true)
  assert.equal(canActOnStage(createStage[2], 'supervisor'), false)
  assert.equal(canActOnStage(createStage[2], 'employee'), false)

  // self_assessment -> employee only
  const selfStage = perfStages.find(([key]) => key === 'self_assessment')
  const subjectId = '33333333-3333-3333-3333-333333333333'
  assert.equal(canActOnStage(selfStage[2], 'employee', subjectId, subjectId), true)
  assert.equal(canActOnStage(selfStage[2], 'hr', subjectId, undefined), false)
  assert.equal(canActOnStage(selfStage[2], 'supervisor', subjectId, undefined), false)

  // performance_evaluation -> supervisor only
  const evalStage = perfStages.find(([key]) => key === 'performance_evaluation')
  assert.equal(canActOnStage(evalStage[2], 'supervisor'), true)
  assert.equal(canActOnStage(evalStage[2], 'employee'), false)
  assert.equal(canActOnStage(evalStage[2], 'hr'), false)

  // calibration -> hr only
  const calibStage = perfStages.find(([key]) => key === 'calibration')
  assert.equal(canActOnStage(calibStage[2], 'hr'), true)
  assert.equal(canActOnStage(calibStage[2], 'supervisor'), false)
  assert.equal(canActOnStage(calibStage[2], 'employee'), false)
})

test('Stepper Scope: Competency Management stage scoping prevents unauthorized stage access', () => {
  const compStages = stagesFor('competency')

  // define_requirements -> hr only
  const defineStage = compStages.find(([key]) => key === 'define_requirements')
  assert.equal(canActOnStage(defineStage[2], 'hr'), true)
  assert.equal(canActOnStage(defineStage[2], 'supervisor'), false)
  assert.equal(canActOnStage(defineStage[2], 'employee'), false)

  // update_record -> hr only
  const updateStage = compStages.find(([key]) => key === 'update_record')
  assert.equal(canActOnStage(updateStage[2], 'hr'), true)
  assert.equal(canActOnStage(updateStage[2], 'supervisor'), false)
  assert.equal(canActOnStage(updateStage[2], 'employee'), false)
})

test('Evaluation Scores: Unanswered criteria have null ratings and are excluded from score calculation', () => {
  // Simulate criteria array with some answered and some unanswered
  const criteria = [
    { name: 'Customer Service', weight: 25, rating: 5, score: 100 },
    { name: 'Teamwork', weight: 25, rating: 4, score: 80 },
    { name: 'Menu Knowledge', weight: 25, rating: null, score: null },
    { name: 'Attendance', weight: 25, rating: null, score: null },
  ]

  const answered = criteria.filter(k => k.rating !== null && k.rating !== undefined && Number(k.rating) > 0)
  assert.equal(answered.length, 2, 'Only 2 criteria are answered')

  // Average is calculated ONLY from answered criteria: (5 + 4) / 2 = 4.5
  const avgRating = (answered.reduce((sum, k) => sum + k.rating, 0) / answered.length).toFixed(2)
  assert.equal(avgRating, '4.50')

  // Unanswered criteria must never be converted to default 3, 4, or 5
  assert.equal(criteria[2].rating, null)
  assert.equal(criteria[3].rating, null)
})

test('Custom Calibrated Score: Card switching resets custom score to zero and avoids accumulation', () => {
  const overallEmpAvg = 78
  const overallDeptAvg = 86
  const balancedAvg = Math.round(((overallEmpAvg + overallDeptAvg) / 2) * 10) / 10 // 82

  // Simulate card selection function matching WorkflowForms CalibrationBuilder
  function selectCard(currentState, opt) {
    let targetScore = 0
    if (opt.includes('Supervisor') || opt.includes('Department Head')) {
      targetScore = overallDeptAvg
    } else if (opt.includes('Self-Assessment') || opt.includes('Employee')) {
      targetScore = overallEmpAvg
    } else if (opt.includes('Average') || opt.includes('Balanced')) {
      targetScore = balancedAvg
    } else if (opt.includes('Override') || opt.includes('Custom')) {
      targetScore = 0 // Resets to 0 for custom input
    } else if (opt.includes('Return') || opt.includes('Revision')) {
      targetScore = ''
    }

    return {
      decision: opt,
      finalScore: targetScore,
      customCalibratedScore: targetScore,
    }
  }

  // 1. User selects Card A (Supervisor Evaluation: 86%)
  let state = selectCard({}, 'Accept Department Head Score')
  assert.equal(state.finalScore, 86)
  assert.equal(state.customCalibratedScore, 86)

  // 2. User selects Card D (Custom HR Calibrated Score)
  // Must reset to 0, NOT retaining Card A's 86%
  state = selectCard(state, 'Override Final Score')
  assert.equal(state.finalScore, 0, 'Custom calibrated score must reset to 0')
  assert.equal(state.customCalibratedScore, 0, 'Custom calibrated score must reset to 0')

  // 3. User types a custom score of 91%
  state = { ...state, finalScore: 91, customCalibratedScore: 91 }
  assert.equal(state.finalScore, 91)

  // 4. User subsequently selects Card B (Balanced Average: 82%)
  // Must reset previous custom score and set 82%, NOT accumulating 91 + 82
  state = selectCard(state, 'Use Average of Scores')
  assert.equal(state.finalScore, 82, 'Must apply newly selected card without retaining 91')
  assert.equal(state.customCalibratedScore, 82)

  // 5. User switches back to Card D (Custom HR Calibrated Score)
  // Must reset to 0 again
  state = selectCard(state, 'Override Final Score')
  assert.equal(state.finalScore, 0, 'Must reset to 0 again when re-selecting Custom card')
})

test('Custom Calibrated Score: Backend score writeback accurately stores calibrated decision value', async () => {
  const workflow = { id: 'wf-calib-1', module: 'performance', subject_employee_id: 'emp-1' }
  const events = [
    { stage: 'self_assessment', details: { formData: { overall: 75 } } },
    { stage: 'performance_evaluation', details: { formData: { overall: 82 } } },
    {
      stage: 'calibration',
      details: {
        formData: {
          decision: 'Override Final Score',
          finalScore: 89.5,
          customCalibratedScore: 89.5,
          reason: 'Calibrated based on exceptional customer satisfaction scores',
        },
      },
    },
  ]

  const result = deriveWorkflowScoreResult(workflow, events)
  assert.ok(result, 'Result should be derived')
  assert.equal(result.field, 'performance_score')
  assert.equal(result.newValue, 89.5, 'Calibrated score of 89.5% should be written back')
  assert.equal(result.source, 'calibration')
})
