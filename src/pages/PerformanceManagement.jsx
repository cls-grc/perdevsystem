import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function PerformanceManagement() {
  return <WorkflowPage module="performance" title="Performance review" description="Manage and complete only the performance review actions assigned to your role." action={{ hr: 'Create review cycle' }} stages={[["Create review", "Set cycle dates and participant groups.", ["hr"]], ["Configure KPI", "Set role KPI templates and criteria.", ["hr"]], ["Notify employees", "Issue review period notifications.", ["hr"]], ["Self assessment", "Complete goals and self-ratings.", ["employee"]], ["Performance evaluation", "Review the employee submission and enter ratings, feedback and evidence.", ["supervisor"]], ["Calibration", "Validate and consolidate ratings.", ["hr"]], ["Final approval", "Approve the finalized evaluation.", ["hr"]], ["Publish results", "Generate reports and publish analytics.", ["hr"]]]} items={[["Emily Thompson", "Restaurant Supervisor", "Pending", "ET"], ["Jordan Williams", "Front Office Staff", "In progress", "JW"], ["Maya Chen", "Operations Manager", "Ready for review", "MC"]]} itemLabel="Employee" itemIsEmployee />
}
