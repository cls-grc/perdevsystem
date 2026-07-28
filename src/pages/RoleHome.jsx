const teamCards = [['Team performance', '84%', 'Review team KPI progress and coaching needs.'], ['Learning completion', '76%', 'Follow up on assigned learning activities.'], ['Reviews requiring action', '6', 'Complete supervisor review steps on time.'], ['Recognition nominations', '4', 'Validate recent team nominations.']]
const personalCards = [['My performance', '84%', 'Review your goals and self-assessment.'], ['Learning progress', '71%', 'Continue your assigned learning pathway.'], ['Development plan', 'Active', 'Focus on leadership and communication skills.'], ['Recognition', '2', 'View your received and submitted recognition.']]
const managementCards = [['Succession approvals', '6', 'Review proposed successors.'], ['Ready-now candidates', '48', 'Approved leadership successors.'], ['Critical roles', '38', 'Roles covered by succession plans.'], ['Planning cycles', '4', 'Active succession cycles.']]

export default function RoleHome({ role, name }) {
  const supervisor = role === 'supervisor'; const management = role === 'management'; const cards = supervisor ? teamCards : management ? managementCards : personalCards
  const title = supervisor ? 'Team Development Dashboard' : management ? 'Leadership Dashboard' : 'My Development Dashboard'
  const description = supervisor ? 'Manage your team’s performance, learning, and workflow actions.' : management ? `Welcome back, ${name}. Review succession plans awaiting senior management approval.` : `Welcome back, ${name}. Track your personal growth and development.`
  const nextTitle = supervisor ? 'Next team action' : management ? 'Next approval' : 'Next action'
  const nextDetail = supervisor ? 'Review outstanding performance submissions and help employees complete assigned learning.' : management ? 'Review proposed succession candidates and approve the finalized plan.' : 'Complete your current review step and continue your assigned learning activities.'
  return <main className="role-home"><div><h1>{title}</h1><p>{description}</p></div><section>{cards.map(([label, value, detail]) => <article key={label}><small>{label}</small><b>{value}</b><p>{detail}</p></article>)}</section><div className="role-home-action"><h2>{nextTitle}</h2><p>{nextDetail}</p></div></main>
}
