import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function TrainingManagement() {
  return <WorkflowPage title="Training management" description="Manage only the training actions assigned to your role." action={{ hr: 'Schedule training' }} stages={[["Schedule training", "Set dates, facilitators and capacity.", ["hr"]], ["Invite participants", "Notify assigned employees and supervisors.", ["hr", "supervisor"]], ["Record attendance", "Confirm attendance and completion.", ["employee", "supervisor", "hr"]], ["Measure effectiveness", "Collect feedback and assessment results.", ["employee", "supervisor"]], ["Publish analytics", "Share completion and outcome data.", ["hr"]]]} items={[["Guest service excellence", "Aug 05 - 24 Front Office Staff", "Confirmed", "GS"], ["Food safety and HACCP", "Aug 08 - 62 Kitchen Staff", "Open", "FS"], ["Restaurant supervisor coaching", "Aug 13 - 18 attendees", "Waitlist", "RC"], ["Housekeeping standards", "Aug 18 - 30 attendees", "Draft", "HS"]]} itemLabel="Training session" />
}
