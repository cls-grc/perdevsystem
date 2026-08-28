import { NavLink } from 'react-router-dom'

const sectionsByRole = {
  hr: [
    {
      title: 'Overview',
      links: [{ to: '/', label: 'AI Analytics Dashboard', icon: 'grid', badge: 'Live' }]
    },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Org Chart & Hierarchy', icon: 'sitemap' },
        { to: '/certificates', label: 'Certificate Management', icon: 'award' }
      ]
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance Reviews', icon: 'trend' },
        { to: '/competency', label: 'Skill Development', icon: 'zap' },
        { to: '/recognition', label: 'Social Recognition', icon: 'heart' }
      ]
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning Progress', icon: 'book' },
        { to: '/training', label: 'Training Management', icon: 'calendar' },
        { to: '/succession', label: 'Succession Planning', icon: 'crown' },
        { to: '/audit', label: 'Audit Trail', icon: 'settings' }
      ]
    }
  ],
  supervisor: [
    {
      title: 'Overview',
      links: [{ to: '/', label: 'Team Dashboard', icon: 'grid', badge: 'Live' }]
    },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Team Org Chart', icon: 'sitemap' }
      ]
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Team Performance', icon: 'trend' },
        { to: '/competency', label: 'Team Development', icon: 'zap' },
        { to: '/recognition', label: 'Recognition Review', icon: 'heart' }
      ]
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Team Learning', icon: 'book' },
        { to: '/training', label: 'Training Attendance', icon: 'calendar' },
        { to: '/certificates', label: 'Team Certificates', icon: 'award' },
        { to: '/succession', label: 'Succession Nominations', icon: 'crown' }
      ]
    }
  ],
  management: [
    {
      title: 'Overview',
      links: [{ to: '/', label: 'Leadership Dashboard', icon: 'grid', badge: 'Live' }]
    },
    {
      title: 'Operations',
      links: [
        { to: '/orgchart', label: 'Hotel Org Chart', icon: 'sitemap' },
        { to: '/succession', label: 'Succession Approvals', icon: 'crown' },
        { to: '/recognition', label: 'Recognition Review', icon: 'heart' }
      ]
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/audit', label: 'Audit Trail', icon: 'settings' }
      ]
    }
  ],
  operations_manager: [
    {
      title: 'Overview',
      links: [{ to: '/', label: 'AI Analytics Dashboard', icon: 'grid', badge: 'Live' }]
    },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Org Chart & Hierarchy', icon: 'sitemap' },
        { to: '/certificates', label: 'Certificate Management', icon: 'award' }
      ]
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance Reviews', icon: 'trend' },
        { to: '/competency', label: 'Skill Development', icon: 'zap' },
        { to: '/recognition', label: 'Recognition Review', icon: 'heart' }
      ]
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning Progress', icon: 'book' },
        { to: '/training', label: 'Training Management', icon: 'calendar' },
        { to: '/succession', label: 'Succession Planning', icon: 'crown' },
        { to: '/audit', label: 'Audit Trail', icon: 'settings' }
      ]
    }
  ],
  employee: [
    {
      title: 'Overview',
      links: [{ to: '/', label: 'My Dashboard', icon: 'grid', badge: 'Live' }]
    },
    {
      title: 'Operations',
      links: [
        { to: '/orgchart', label: 'Hotel Org Chart', icon: 'sitemap' },
        { to: '/performance', label: 'My Performance', icon: 'trend' },
        { to: '/competency', label: 'My Development Plan', icon: 'zap' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' }
      ]
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'My Learning', icon: 'book' },
        { to: '/training', label: 'My Training', icon: 'calendar' },
        { to: '/certificates', label: 'My Certificates', icon: 'award' }
      ]
    }
  ]
}

export function Icon({ name, size = 20 }) {
  const p = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    trend: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </>
    ),
    zap: (
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    ),
    award: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="m8.5 12.2-1 8 4.5-2.5 4.5 2.5-1-8" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10M6 10h10M6 14h6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    crown: (
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    ),
    heart: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.2 1.6Z" />
      </>
    ),
    bell: (
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </>
    ),
    sitemap: (
      <>
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <rect x="3" y="16" width="5" height="5" rx="1" />
        <rect x="10" y="16" width="5" height="5" rx="1" />
        <rect x="17" y="16" width="5" height="5" rx="1" />
        <path d="M12 8v4M5.5 12h13v4M5.5 16v-4M12.5 16v-4" />
      </>
    ),
    chevron: (
      <path d="m9 18 6-6-6-6" />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-icon"
    >
      {p[name] || p.grid}
    </svg>
  )
}

export default function Sidebar({ user, onLogout }) {
  const roleLabel =
    {
      hr: 'HR Administrator',
      supervisor: 'Department Head',
      management: 'Senior Management',
      operations_manager: 'Operations Manager',
      employee: 'Employee'
    }[user.role] || user.role

  const initials = user.name
    ? (user.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()
    : 'HR'

  const navSections = sectionsByRole[user.role] || sectionsByRole.employee

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-wrapper">
        <div className="brand">
          <div className="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#brandGrad)" />
              <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              <defs>
                <linearGradient id="brandGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9333ea" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text-block">
            <span className="brand-name">PerDevSys</span>
            <span className="brand-badge">HOSPITALITY HR</span>
          </div>
        </div>
      </div>

      {/* Main Navigation List */}
      <div className="nav-list">
        {navSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="section-title">{section.title}</div>
            <div className="section-list">
              {section.links.map((item) =>
                item.disabled ? (
                  <div key={item.label} className="nav-item disabled">
                    <span className="nav-icon-wrap"><Icon name={item.icon} size={16} /></span>
                    <span className="label">{item.label}</span>
                  </div>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                  >
                    <span className="nav-icon-wrap"><Icon name={item.icon} size={16} /></span>
                    <span className="label">{item.label}</span>
                    {item.badge && <span className="nav-badge-pill">{item.badge}</span>}
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User Profile Pill at Bottom */}
      <div className="sidebar-footer">
        <div className="profile-mini profile-rbac">
          <span className="avatar avatar-lia">{initials}</span>
          <div className="profile-info">
            <b title={user.name}>{user.name}</b>
            <small>{roleLabel}</small>
          </div>
          <span className="role-dot" title={`Role: ${roleLabel}`} />
        </div>
        <button className="sidebar-signout" type="button" onClick={onLogout}>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
