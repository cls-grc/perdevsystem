import React, { useState, useEffect, useCallback } from 'react'
import WorkflowPage from '../components/WorkflowPage'
import BadgePickerModal from '../components/BadgePickerModal'
import { api } from '../lib/api'

export default function SocialRecognition() {
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
  const [employees, setEmployees] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch real employee list from backend database for nomination dropdown
  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.analytics()
      if (res && Array.isArray(res.employees)) {
        setEmployees(res.employees)
      }
    } catch (err) {
      console.warn('[SocialRecognition] Could not load active employees:', err.message)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const handleNominationSuccess = (noticeMsg) => {
    // Increment refreshKey to trigger live reload in WorkflowPage & Leaderboard
    setRefreshKey(prev => prev + 1)
    loadEmployees()
  }

  return (
    <>
      <WorkflowPage
        key={refreshKey}
        module="recognition"
        title="Social recognition"
        description="Recognize outstanding hospitality achievements, track real-time peer awards, and view top-ranked staff on the recognition leaderboard."
        action={{ employee: 'Submit nomination', supervisor: 'Validate nomination', hr: 'Review nomination' }}
        metrics={[
          ["Nominations", "Live DB", "This month"],
          ["Approval rate", "92%", "HR validated"],
          ["Badges issued", "Live DB", "Digital badges"],
          ["Top-recognized team", "Front Office", "Leading department"]
        ]}
        stages={[
          ["Submit nomination", "Nominate a peer or subordinate with a badge tier & citation.", ["employee", "supervisor", "hr"]],
          ["Supervisor validation", "Verify achievement details and approve badge point value.", ["supervisor"]],
          ["HR review", "Final approval, certificate generation & leaderboard update.", ["hr"]]
        ]}
        items={[
          ["Jordan Williams", "Customer Obsession Gold Badge — nominated by Ana", "In review", "JW"],
          ["Emily Thompson", "Leadership Excellence Silver Badge — nominated by Ryan", "Approved", "ET"],
          ["Maya Chen", "Innovation & Safety Excellence Badge — nominated by Lia", "Badge issued", "MC"],
          ["Ava Reyes", "Bronze Service Star — nominated by Jordan", "Needs detail", "AR"]
        ]}
        itemLabel="Recognition nomination"
        itemIsEmployee
        onOpenBadgePicker={() => setIsBadgeModalOpen(true)}
        extraHeaderAction={
          <button
            type="button"
            onClick={() => setIsBadgeModalOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #654bd2, #4f32c2)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(101, 75, 210, 0.25)',
            }}
          >
            <span>🏆</span> Nominate & Issue Badge
          </button>
        }
      />

      <BadgePickerModal
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        onSuccess={handleNominationSuccess}
        employees={employees}
      />
    </>
  )
}
