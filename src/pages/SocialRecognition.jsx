import React from 'react'
import WorkflowPage from '../components/WorkflowPage'

export default function SocialRecognition() {
  return (
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
  )
}

