import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import WorkflowPage from '../components/WorkflowPage'
import {
  Heart,
  ThumbsUp,
  Trophy,
  Star,
  Flame,
  Award,
  Users,
  ShieldCheck,
  Crown,
  Send,
  MessageSquare,
  Layers,
  Sparkles,
  CheckCircle2,
  Building2,
} from 'lucide-react'
import '../recognitionWall.css'

const CORE_VALUE_TAGS = [
  { id: 'ALL', label: 'All Values', icon: Layers, tag: 'ALL' },
  { id: 'hospitality', label: 'Excellence in Hospitality', icon: Award, tag: '#ExcellenceInHospitality' },
  { id: 'guest', label: 'Guest Delight', icon: Star, tag: '#GuestDelight' },
  { id: 'teamwork', label: 'Teamwork & Integrity', icon: Users, tag: '#Teamwork' },
  { id: 'culinary', label: 'Culinary Mastery', icon: Flame, tag: '#CulinaryMastery' },
  { id: 'safety', label: 'Safety & Hygiene', icon: ShieldCheck, tag: '#SafetyFirst' },
  { id: 'leadership', label: 'Leadership in Action', icon: Crown, tag: '#Leadership' },
]

const AWARD_BADGES = [
  { name: 'Guest Delight Champion', value: 'Guest Delight', tag: '#GuestDelight', icon: Star },
  { name: 'Excellence in Hospitality', value: 'Excellence in Hospitality', tag: '#ExcellenceInHospitality', icon: Award },
  { name: 'Culinary Mastery Award', value: 'Culinary Mastery', tag: '#CulinaryMastery', icon: Flame },
  { name: 'Team Player Award', value: 'Teamwork & Integrity', tag: '#Teamwork', icon: Users },
  { name: 'Safety & Cleanliness Hero', value: 'Safety & Hygiene First', tag: '#SafetyFirst', icon: ShieldCheck },
  { name: 'Leadership in Action', value: 'Leadership in Action', tag: '#Leadership', icon: Crown },
]

export default function SocialRecognition() {
  const [activeTab, setActiveTab] = useState('wall') // 'wall' | 'workflows'
  const [feed, setFeed] = useState([])
  const [leaderboard, setLeaderboard] = useState({ topStaff: [], topDepartments: [], coreValues: [] })
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('ALL')
  const [commentOpen, setCommentOpen] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})

  // Inline composer state
  const [staffList, setStaffList] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedBadge, setSelectedBadge] = useState(AWARD_BADGES[0].name)
  const [customMessage, setCustomMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusNotice, setStatusNotice] = useState('')

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [feedRes, lbRes, staffRes] = await Promise.all([
          api.recognitionFeed().catch(() => ({ feed: [] })),
          api.recognitionLeaderboard().catch(() => ({ topStaff: [], topDepartments: [], coreValues: [] })),
          api.workflowSubjects().catch(() => ({ employees: [] })),
        ])
        if (!active) return
        setFeed(feedRes.feed || [])
        setLeaderboard(lbRes || { topStaff: [], topDepartments: [], coreValues: [] })
        setStaffList(staffRes.employees || [])
        if (staffRes.employees?.length > 0) {
          setSelectedStaffId(staffRes.employees[0].id)
        }
      } catch {
        // Fallback
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => { active = false }
  }, [])

  // Reaction toggling (NO EMOJIS - pure icons)
  const handleReaction = async (postId, reactionType) => {
    try {
      const res = await api.reactRecognition(postId, reactionType)
      setFeed((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, reactions: res.reactions, userReactions: res.userReactions }
            : item
        )
      )
    } catch {
      // Local optimistic update
      setFeed((prev) =>
        prev.map((item) => {
          if (item.id !== postId) return item
          const has = item.userReactions?.includes(reactionType)
          const nextUserReactions = has
            ? item.userReactions.filter((r) => r !== reactionType)
            : [...(item.userReactions || []), reactionType]
          const nextCount = Math.max(0, (item.reactions?.[reactionType] || 0) + (has ? -1 : 1))
          return {
            ...item,
            userReactions: nextUserReactions,
            reactions: { ...item.reactions, [reactionType]: nextCount },
          }
        })
      )
    }
  }

  // Comment submit
  const handleAddComment = async (postId) => {
    const text = commentDrafts[postId]?.trim()
    if (!text) return
    try {
      const res = await api.commentRecognition(postId, text)
      setFeed((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, comments: [...(item.comments || []), res.comment] }
            : item
        )
      )
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
    } catch {
      // Fallback
    }
  }

  // Submit Give Recognition
  const handleSubmitRecognition = async (e) => {
    e.preventDefault()
    if (!selectedStaffId || !customMessage.trim()) return
    const targetEmployee = staffList.find((s) => s.id === selectedStaffId)
    if (!targetEmployee) return

    const badgeConfig = AWARD_BADGES.find((b) => b.name === selectedBadge) || AWARD_BADGES[0]

    setSubmitting(true)
    try {
      const res = await api.postRecognition({
        recipientId: targetEmployee.id,
        recipientName: targetEmployee.full_name,
        recipientDepartment: targetEmployee.department,
        recipientJobTitle: targetEmployee.job_title,
        badge: badgeConfig.name,
        coreValue: badgeConfig.value,
        tag: badgeConfig.tag,
        message: customMessage.trim(),
      })

      if (res.post) {
        setFeed((prev) => [res.post, ...prev])
      }
      setCustomMessage('')
      setStatusNotice(`Recognition published for ${targetEmployee.full_name}!`)
      setTimeout(() => setStatusNotice(''), 4000)
    } catch {
      setStatusNotice('Unable to post recognition. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredFeed = feed.filter((item) => {
    if (selectedTag === 'ALL') return true
    return item.tag === selectedTag || item.coreValue === selectedTag
  })

  const tabsNav = (
    <div className="recognition-tabs-nav">
      <button
        type="button"
        className={`recognition-tab-btn ${activeTab === 'wall' ? 'active' : ''}`}
        onClick={() => setActiveTab('wall')}
      >
        <Heart size={14} />
        <span>Recognition Wall</span>
      </button>
      <button
        type="button"
        className={`recognition-tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
        onClick={() => setActiveTab('workflows')}
      >
        <Award size={14} />
        <span>Nomination Workflows</span>
      </button>
    </div>
  )

  if (activeTab === 'workflows') {
    return (
      <WorkflowPage
        module="recognition"
        title="Social Recognition Nominations"
        description="Complete the recognition actions assigned to your role. Once HR approves a nomination, the system automatically issues the badge and updates the leaderboard."
        action={{
          employee: 'Submit nomination',
          supervisor: 'Validate nomination',
          hr: 'Review nomination',
          operations_manager: 'Review nomination',
        }}
        itemLabel="Recognition nomination"
        itemIsEmployee
        extraHeaderAction={tabsNav}
      />
    )
  }

  return (
    <div className="recognition-page-wrapper">
      {/* ── HEADER & NAVIGATION ────────────────────────────────────────────── */}
      <div className="recognition-header-bar">
        <div className="recognition-title-area">
          <h1>Social Recognition & Merit Wall</h1>
          <p>Celebrate team achievements, peer commendations, and core hospitality values across the hotel.</p>
        </div>
        {tabsNav}
      </div>

      {statusNotice && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 14,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            color: '#059669',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* ── TAB 1: SOCIAL RECOGNITION WALL ─────────────────────────────────── */}
      <div className="recognition-wall-layout">
          {/* Left Column: Feed Stream */}
          <div>
            {/* ── INLINE RECOGNITION COMPOSER CARD ────────────────────────── */}
            <div className="recognition-composer-card">
              <div className="composer-header">
                <Heart size={16} color="#513AB3" />
                <span>Give Recognition</span>
              </div>
              <form onSubmit={handleSubmitRecognition}>
                <div className="composer-row">
                  <div>
                    <label className="recog-field-label" style={{ display: 'block', marginBottom: 5 }}>Colleague</label>
                    <select
                      className="recog-select"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      required
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} — {s.job_title} ({s.department})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="recog-field-label" style={{ display: 'block', marginBottom: 5 }}>Award Badge</label>
                    <select
                      className="recog-select"
                      value={selectedBadge}
                      onChange={(e) => setSelectedBadge(e.target.value)}
                    >
                      {AWARD_BADGES.map((b) => (
                        <option key={b.name} value={b.name}>{b.name} ({b.tag})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  className="composer-textarea"
                  placeholder="Share specific examples of how this colleague went above and beyond…"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  required
                />
                <div className="composer-footer">
                  <button
                    type="submit"
                    className="org-drawer-action-btn"
                    disabled={submitting || !customMessage.trim()}
                  >
                    <Send size={14} />
                    <span>{submitting ? 'Publishing…' : 'Publish Recognition'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Value Filter Pills */}
            <div className="recognition-values-bar">
              {CORE_VALUE_TAGS.map((val) => {
                const Icon = val.icon
                const isActive = selectedTag === val.tag
                return (
                  <button
                    key={val.id}
                    type="button"
                    className={`value-filter-pill ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedTag(val.tag)}
                  >
                    <Icon size={13} />
                    <span>{val.label}</span>
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 300, justifyContent: 'center', gap: 10 }}>
                <div className="skeleton-bar" style={{ width: 140, height: 14, borderRadius: 6 }} />
                <div style={{ fontSize: 13, color: '#64748b' }}>Loading Social Recognition Feed…</div>
              </div>
            ) : filteredFeed.length === 0 ? (
              <div style={{ padding: 48, background: '#ffffff', borderRadius: 20, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <Sparkles size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>No recognition posts found</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Be the first to recognize a colleague for their outstanding work!</div>
              </div>
            ) : (
              <div className="recognition-feed-stream">
                {filteredFeed.map((post) => {
                  const initials = post.recipientName
                    ? post.recipientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'EM'
                  const comments = post.comments || []
                  const isCommentsOpen = commentOpen[post.id]

                  return (
                    <div key={post.id} className="recognition-post-card">
                      {post.isOfficialAward && (
                        <div className="post-official-ribbon">
                          <CheckCircle2 size={12} />
                          <span>Official HR Award</span>
                        </div>
                      )}

                      {/* Header */}
                      <div className="post-header">
                        <div className="post-avatar">{initials}</div>
                        <div className="post-meta-wrap">
                          <div className="post-title-line">
                            {post.recipientName}
                            <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}> was recognized by </span>
                            {post.senderName}
                          </div>
                          <div className="post-subtitle-line">
                            {post.recipientJobTitle} • {post.recipientDepartment}
                          </div>
                        </div>
                      </div>

                      {/* Badge and Tag */}
                      <div className="post-badge-strip">
                        <span className="post-badge-chip">
                          <Award size={13} />
                          <span>{post.badge}</span>
                        </span>
                        <span className="post-hashtag-chip">
                          <span>{post.tag}</span>
                        </span>
                      </div>

                      {/* Message */}
                      <div className="post-message-body">{post.message}</div>

                      {/* Icon Reaction Bar (STRICTLY ICONS, NO EMOJIS) */}
                      <div className="post-reaction-bar">
                        {/* 1. Heart */}
                        <button
                          type="button"
                          className={`reaction-icon-btn ${post.userReactions?.includes('heart') ? 'reacted' : ''}`}
                          onClick={() => handleReaction(post.id, 'heart')}
                          title="Appreciate"
                        >
                          <Heart size={14} />
                          <span>{post.reactions?.heart || 0}</span>
                        </button>

                        {/* 2. Thumbs Up */}
                        <button
                          type="button"
                          className={`reaction-icon-btn ${post.userReactions?.includes('thumbsUp') ? 'reacted' : ''}`}
                          onClick={() => handleReaction(post.id, 'thumbsUp')}
                          title="Great Job"
                        >
                          <ThumbsUp size={14} />
                          <span>{post.reactions?.thumbsUp || 0}</span>
                        </button>

                        {/* 3. Trophy */}
                        <button
                          type="button"
                          className={`reaction-icon-btn ${post.userReactions?.includes('trophy') ? 'reacted' : ''}`}
                          onClick={() => handleReaction(post.id, 'trophy')}
                          title="Top Performance"
                        >
                          <Trophy size={14} />
                          <span>{post.reactions?.trophy || 0}</span>
                        </button>

                        {/* 4. Star */}
                        <button
                          type="button"
                          className={`reaction-icon-btn ${post.userReactions?.includes('star') ? 'reacted' : ''}`}
                          onClick={() => handleReaction(post.id, 'star')}
                          title="Excellence"
                        >
                          <Star size={14} />
                          <span>{post.reactions?.star || 0}</span>
                        </button>

                        {/* 5. Flame */}
                        <button
                          type="button"
                          className={`reaction-icon-btn ${post.userReactions?.includes('flame') ? 'reacted' : ''}`}
                          onClick={() => handleReaction(post.id, 'flame')}
                          title="On Fire"
                        >
                          <Flame size={14} />
                          <span>{post.reactions?.flame || 0}</span>
                        </button>

                        {/* Comments Count Toggle */}
                        <button
                          type="button"
                          className="post-comments-toggle"
                          onClick={() =>
                            setCommentOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                          }
                        >
                          <MessageSquare size={14} />
                          <span>{comments.length} Comments</span>
                        </button>
                      </div>

                      {/* Comments Panel */}
                      {isCommentsOpen && (
                        <div className="post-comments-panel">
                          {comments.map((c) => (
                            <div key={c.id} className="comment-row">
                              <div className="comment-author">{c.userName} ({c.userRole})</div>
                              <div>{c.text}</div>
                            </div>
                          ))}

                          <div className="comment-input-row">
                            <input
                              type="text"
                              placeholder="Write a congratulatory comment…"
                              value={commentDrafts[post.id] || ''}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(post.id)
                              }}
                            />
                            <button
                              type="button"
                              className="comment-send-btn"
                              onClick={() => handleAddComment(post.id)}
                            >
                              <Send size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Leaderboard & Stats */}
          <div className="recognition-sidebar-column">
            {/* Top Recognized Staff */}
            <div className="recognition-leaderboard-card">
              <div className="leaderboard-title">
                <Trophy size={18} color="#513AB3" />
                <span>Monthly Staff Spotlight</span>
              </div>
              <div className="leaderboard-list">
                {leaderboard.topStaff?.map((staff, idx) => (
                  <div key={staff.name} className="leaderboard-item">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="rank-badge">{idx + 1}</span>
                      <div>
                        <div className="leaderboard-item-name">{staff.name}</div>
                        <div className="leaderboard-item-sub">{staff.department}</div>
                      </div>
                    </div>
                    <div className="leaderboard-item-count">
                      <Award size={13} />
                      <span>{staff.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Kudos Leaderboard */}
            <div className="recognition-leaderboard-card">
              <div className="leaderboard-title">
                <Building2 size={18} color="#513AB3" />
                <span>Department Kudos</span>
              </div>
              <div className="leaderboard-list">
                {leaderboard.topDepartments?.map((dept) => (
                  <div key={dept.department} className="leaderboard-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={15} />
                      <span className="leaderboard-item-name">{dept.department}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: '#059669' }}>{dept.totalKudos} kudos</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}

