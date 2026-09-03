import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function CompetencyManagement() {
  return (
    <WorkflowPage
      module="competency"
      title="Skill development"
      description="Manage the competency and development-plan actions assigned to your role."
      action={{ hr: 'Create development plan' }}
      stages={[
        ["Define competency requirements", "Define hospitality competency requirements and development objectives.", ["hr"]],
        ["Assign development plan", "Review detected skill gaps, pick recommended learning courses, and assign learning paths.", ["hr", "supervisor"]],
        ["Track learning progress", "Review assigned learning and development progress.", ["employee", "supervisor"]],
        ["Update competency record", "Update competency records and analytics.", ["hr"]],
      ]}
      items={[]}
      itemLabel="Development plan"
      itemIsEmployee
    />
  )
}
