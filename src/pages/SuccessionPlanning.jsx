import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function SuccessionPlanning() {
  return <WorkflowPage title="Succession planning" description="Complete the succession planning actions assigned to your role. Employee records and readiness scores are updated automatically by the system." action={{ hr: 'Start succession cycle', supervisor: 'Nominate candidate', management: 'Approve succession plan' }} stages={[["Initiate planning cycle", "Set the critical roles and planning scope.", ["hr"]], ["Nominate candidates", "Submit succession candidates for your department.", ["supervisor"]], ["Review readiness assessments", "Review the system-calculated readiness scores.", ["hr"]], ["Management approval", "Approve the proposed succession candidates.", ["management"]]]} items={[["Maya Chen", "Front Office Manager - Ready now", "Approved", "MC"], ["Ryan Wong", "Operations Manager - Ready in 1 year", "In review", "RW"], ["Emily Thompson", "Hotel Manager - Ready now", "Approved", "ET"], ["Ana Silva", "Restaurant Manager - Ready in 2 years", "Development plan", "AS"]]} itemLabel="Succession candidate" itemIsEmployee />
}
