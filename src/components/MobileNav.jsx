import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Sidebar'

const sectionsByRole = {
  hr: [
    { title: 'Overview', links: [{ to: '/', label: 'Analytics', icon: 'grid' }] },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/certificates', label: 'Certificates', icon: 'award' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Skill Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/succession', label: 'Succession', icon: 'users' },
        { to: '/audit', label: 'Audit Trail', icon: 'settings' },
      ],
    },
  ],
  supervisor: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    { title: 'Administration', links: [{ to: '/employees', label: 'Employee Records', icon: 'users' }] },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Team Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/certificates', label: 'Certificates', icon: 'award' },
        { to: '/succession', label: 'Succession', icon: 'users' },
      ],
    },
  ],
  management: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    {
      title: 'Operations',
      links: [
        { to: '/succession', label: 'Succession', icon: 'users' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    { title: 'Monitoring', links: [{ to: '/audit', label: 'Audit Trail', icon: 'settings' }] },
  ],
  operations_manager: [
    { title: 'Overview', links: [{ to: '/', label: 'Analytics', icon: 'grid' }] },
    { title: 'Administration', links: [{ to: '/employees', label: 'Employee Records', icon: 'users' }, { to: '/certificates', label: 'Certificates', icon: 'award' }] },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Skill Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/succession', label: 'Succession', icon: 'users' },
        { to: '/audit', label: 'Audit Trail', icon: 'settings' },
      ],
    },
  ],
  employee: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Development', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/certificates', label: 'My Certificates', icon: 'award' },
      ],
    },
  ],
}

export default function MobileNav({ user, onLogout, open, onClose }) {
  const sections = sectionsByRole[user.role] || sectionsByRole.employee

  const close = () => onClose && onClose()

  return (
    <>
      {open && (
        <>
          <div className="mobile-nav-backdrop" onClick={close} />
          <aside className="mobile-nav-drawer">
            <button className="mobile-nav-close" onClick={close} aria-label="Close menu">×</button>
            <div className="brand">
              <span className="brand-mark"><span /></span>
              <span>PerDevSys</span>
            </div>
            <p className="workspace-label">HOSPITALITY HR</p>

            <div className="nav-list">
              {sections.map((section) => (
                <div key={section.title}>
                  <div className="mobile-nav-section-title">{section.title}</div>
                  {section.links.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={close}
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>

            <div className="mobile-nav-profile">
              <span className="avatar avatar-lia">
                {user.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b style={{ fontSize: 12, color: '#1f2230' }}>{user.name}</b>
                <small style={{ display: 'block', fontSize: 10, color: '#7d8095' }}>{user.role}</small>
              </div>
              <button className="mobile-nav-signout" onClick={() => { close(); onLogout() }}>Sign out</button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
