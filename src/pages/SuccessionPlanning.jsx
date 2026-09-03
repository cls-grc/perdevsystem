import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function SuccessionPlanning() {
  return (
    <WorkflowPage
      module="succession"
      title="Succession planning"
      description="Complete the succession planning actions assigned to your role. Employee records and readiness scores are updated automatically by the system."
      action={{
        hr: 'Start succession cycle',
        supervisor: 'Nominate candidate',
        management: 'Approve succession plan',
      }}
      stages={[
        ['Initiate planning cycle', 'Set the critical roles and planning scope.', ['hr']],
        ['Nominate candidates', 'Submit succession candidates for your department.', ['supervisor']],
        ['Review readiness assessments', 'Review the system-calculated readiness scores.', ['hr']],
        ['Management approval', 'Approve the proposed succession candidates.', ['management']],
      ]}
      items={[]}
      itemLabel="Succession candidate"
      itemIsEmployee
    />
  )
}
