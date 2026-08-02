import test from 'node:test'
import assert from 'node:assert/strict'
import { nextStage, stagesFor, returnToStage, previousStages } from '../src/workflow.js'
import { calculatePerformance, calculateReadiness } from '../src/services/metrics.js'

test('performance workflow advances only in its defined order', () => {
  assert.deepEqual(nextStage('performance', 'self_assessment', 'employee'), { key: 'supervisor_review', label: 'Supervisor review', roles: ['supervisor'] })
  assert.throws(() => nextStage('performance', 'self_assessment', 'supervisor'), { status: 403 })
})

test('only HR may complete the published performance stage', () => {
  assert.equal(nextStage('performance', 'published', 'hr'), null)
  assert.throws(() => nextStage('performance', 'published', 'employee'), { status: 403 })
})

test('every module has a valid actionable workflow', () => {
  const expectedModules = ['performance', 'competency', 'learning', 'training', 'succession', 'recognition']

  for (const module of expectedModules) {
    const stages = stagesFor(module)
    const [firstKey, , firstRoles] = stages[0]
    const [lastKey, , lastRoles] = stages.at(-1)

    assert.ok(firstRoles.length, `${module} should have a role that can start it`)
    assert.ok(lastRoles.length, `${module} should have a role that can finish it`)
    assert.doesNotThrow(() => nextStage(module, firstKey, firstRoles[0]))
    assert.equal(nextStage(module, lastKey, lastRoles[0]), null)
  }
})

test('returnToStage moves a workflow to an earlier stage for the current owner', () => {
  assert.deepEqual(returnToStage('performance', 'supervisor_review', 'supervisor'), { key: 'self_assessment', label: 'Self assessment', roles: ['employee'] })
  assert.deepEqual(returnToStage('performance', 'performance_evaluation', 'supervisor', 'self_assessment'), { key: 'self_assessment', label: 'Self assessment', roles: ['employee'] })
})

test('returnToStage rejects invalid targets and non-owners', () => {
  assert.throws(() => returnToStage('performance', 'self_assessment', 'supervisor'), { status: 403 })
  assert.throws(() => returnToStage('performance', 'create_review', 'hr'), { status: 409 })
  assert.throws(() => returnToStage('performance', 'calibration', 'hr', 'final_approval'), { status: 400 })
  assert.throws(() => returnToStage('performance', 'calibration', 'hr', 'does_not_exist'), { status: 400 })
})

test('previousStages returns only stages before the current one', () => {
  const stages = previousStages('performance', 'calibration', 'hr')
  assert.deepEqual(stages.map(({ key }) => key), ['create_review', 'configure_kpi', 'notify_employee', 'self_assessment', 'supervisor_review', 'performance_evaluation'])
  assert.throws(() => previousStages('performance', 'self_assessment', 'supervisor'), { status: 403 })
})

test('scores use stable documented weightings', () => {
  assert.equal(calculatePerformance({ kpi: 80, competency: 90, behavior: 70 }), 81)
  assert.deepEqual(calculateReadiness({ performance: 90, competency: 80, learning: 90 }), { score: 87, band: 'ready_now' })
})
