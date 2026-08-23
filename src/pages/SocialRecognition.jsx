import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function SocialRecognition() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info Bar — consistent with other module pages */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card, #fff)',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
            Social Recognition &amp; Awards
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
            Submit nominations, validate achievements, approve awards, and issue digital badges automatically.
          </p>
        </div>
      </div>

      {/* Main Workflow Engine */}
      <WorkflowPage
        module="recognition"
        title="Social recognition"
        description="Complete the recognition actions assigned to your role. Once HR approves a nomination, the system automatically issues the badge and updates the leaderboard."
        action={{
          employee: 'Submit nomination',
          supervisor: 'Validate nomination',
          hr: 'Review nomination',
          operations_manager: 'Review nomination',
        }}
        itemLabel="Recognition nomination"
        itemIsEmployee
      />
    </div>
  )
}
