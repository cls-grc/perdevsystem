import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function PerformanceManagement() {
  return (
    <WorkflowPage
      module="performance"
      title="Performance review"
      description="Manage and complete only the performance review actions assigned to your role."
      action={{ hr: 'Create review cycle', supervisor: 'Performance evaluation' }}
      stages={[
        ['Create review', 'Select employee, set review period, dates, and review type.', ['hr']],
        ['Self assessment', 'Complete goals and self-ratings against competencies and KPIs.', ['employee']],
        ['Performance evaluation', 'Review the employee submission and enter ratings, feedback and evidence.', ['supervisor']],
        ['Calibration', 'Validate, compare variance, and align scores.', ['hr']],
        ['Final approval', 'Approve the finalized evaluation.', ['hr']],
        ['Publish results', 'Generate reports, notify employee, and complete review.', ['hr']],
      ]}
      items={[]}
      itemLabel="Employee"
      itemIsEmployee
    />
  )
}

