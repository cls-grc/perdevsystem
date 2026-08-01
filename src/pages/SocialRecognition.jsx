import React, { useEffect, useRef, useState } from 'react'
import WorkflowPage from '../components/WorkflowPage'
import CertificateManagement from './CertificateManagement'

const getUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem('pds-user') || '{}').role
  } catch {
    return ''
  }
}

export default function SocialRecognition() {
  const [showCertificates, setShowCertificates] = useState(false)
  const certificateRef = useRef(null)
  const role = getUserRole()
  const canManageCertificates = ['hr', 'employee', 'operations_manager'].includes(role)

  useEffect(() => {
    if (showCertificates && certificateRef.current) {
      certificateRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showCertificates])

  return (
    <>
      <WorkflowPage
        title="Social recognition"
        description="Complete the recognition action assigned to your role. Once HR approves a nomination, the system automatically issues the badge and certificate, updates the leaderboard, and stores the record."
        action={{ employee: 'Submit nomination', supervisor: 'Validate nomination', hr: 'Review nomination' }}
        extraHeaderAction={canManageCertificates ? <button className="module-secondary" type="button" onClick={() => setShowCertificates(value => !value)}>{showCertificates ? 'Hide certificates' : 'Manage certificates'}</button> : null}
        metrics={[["Nominations", "84", "This month"], ["Approval rate", "92%", "HR validated"], ["Badges issued", "77", "Digital badges"], ["Top-recognized team", "Product", "18 recognitions"]]}
        stages={[["Submit nomination", "Share a recognition nomination.", ["employee"]], ["Supervisor validation", "Verify the achievement and nomination.", ["supervisor"]], ["HR review", "Approve or return the nomination.", ["hr"]]]}
        items={[["Jordan Williams", "Customer obsession - nominated by Ana", "In review", "JW"], ["Emily Thompson", "Leadership - nominated by Ryan", "Approved", "ET"], ["Maya Chen", "Innovation - nominated by Lia", "Badge issued", "MC"], ["Ava Reyes", "Service excellence - nominated by Jordan", "Needs detail", "AR"]]}
        itemLabel="Recognition nomination"
        itemIsEmployee
      />
      {showCertificates && canManageCertificates && (
        <section className="certificate-embedded-wrapper" ref={certificateRef}>
          <CertificateManagement embedded />
        </section>
      )}
    </>
  )
}
