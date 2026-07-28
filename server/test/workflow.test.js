import test from 'node:test'
import assert from 'node:assert/strict'
import { nextStage } from '../src/workflow.js'
import { calculatePerformance, calculateReadiness } from '../src/services/metrics.js'

test('performance workflow advances only in its defined order', () => {
  assert.deepEqual(nextStage('performance', 'self_assessment', 'employee'), { key: 'supervisor_review', label: 'Supervisor review', roles: ['supervisor'] })
  assert.throws(() => nextStage('performance', 'self_assessment', 'supervisor'), { status: 403 })
})

test('only HR may complete the published performance stage', () => {
  assert.equal(nextStage('performance', 'published', 'hr'), null)
  assert.throws(() => nextStage('performance', 'published', 'employee'), { status: 403 })
})

test('scores use stable documented weightings', () => {
  assert.equal(calculatePerformance({ kpi: 80, competency: 90, behavior: 70 }), 81)
  assert.deepEqual(calculateReadiness({ performance: 90, competency: 80, learning: 90 }), { score: 87, band: 'ready_now' })
})
