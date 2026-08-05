import WorkflowPage from '../components/WorkflowPage'

export default function SocialRecognition() {
  return (
    <WorkflowPage
      title="Social recognition"
      description="Complete the recognition action assigned to your role. Once HR approves a nomination, the system automatically issues the badge and certificate, updates the leaderboard, and stores the record."
      action={{ employee: 'Submit nomination', supervisor: 'Validate nomination', hr: 'Review nomination' }}
      metrics={[["Nominations", "84", "This month"], ["Approval rate", "92%", "HR validated"], ["Badges issued", "77", "Digital badges"], ["Top-recognized team", "Product", "18 recognitions"]]}
stages={[["Submit nomination", "Share a recognition nomination.", ["employee", "hr"]], ["Supervisor validation", "Verify the achievement and nomination.", ["supervisor"]], ["HR review", "Approve or return the nomination.", ["hr"]]]}
      items={[["Jordan Williams", "Customer obsession - nominated by Ana", "In review", "JW"], ["Emily Thompson", "Leadership - nominated by Ryan", "Approved", "ET"], ["Maya Chen", "Innovation - nominated by Lia", "Badge issued", "MC"], ["Ava Reyes", "Service excellence - nominated by Jordan", "Needs detail", "AR"]]}
      itemLabel="Recognition nomination"
      itemIsEmployee
    />
  )
}
