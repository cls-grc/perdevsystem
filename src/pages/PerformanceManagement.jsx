import React, { useState } from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function PerformanceManagement() {
  const [activeTab, setActiveTab] = useState('workflows')

  return (
    <div className="performance-management-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info Bar */}
      <div className="performance-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card, #fff)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Performance Reviews & Evaluation</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
            Configure KPI scorecards, perform employee self-assessments, supervisor evaluation scorecards, and HR calibration.
          </p>
        </div>
      </div>

      {/* Main Workflow Engine Integration */}
      <WorkflowPage
        module="performance"
        title="Performance review"
        description="Manage and complete only the performance review actions assigned to your role."
        action={{ hr: 'Create review cycle' }}
        stages={[
          ['Create review', 'Set cycle dates and participant groups.', ['hr']],
          ['Configure KPI', 'Set role KPI templates and criteria.', ['hr']],
          ['Notify employees', 'Issue review period notifications.', ['hr']],
          ['Self assessment', 'Complete goals and self-ratings.', ['employee']],
          ['Performance evaluation', 'Review the employee submission and enter ratings, feedback and evidence.', ['supervisor']],
          ['Calibration', 'Validate and consolidate ratings.', ['hr']],
          ['Final approval', 'Approve the finalized evaluation.', ['hr']],
          ['Publish results', 'Generate reports and publish analytics.', ['hr']],
        ]}
        items={[
          ['Emily Thompson', 'Restaurant Supervisor', 'Pending', 'ET'],
          ['Jordan Williams', 'Front Office Staff', 'In progress', 'JW'],
          ['Maya Chen', 'Operations Manager', 'Ready for review', 'MC'],
        ]}
        itemLabel="Employee"
        itemIsEmployee
      />
    </div>
  )
}
