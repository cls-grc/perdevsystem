import React, { useEffect, useState } from 'react'
import { Icon } from './Sidebar'
import { api } from '../lib/api'
import AIChatDrawer from './AIChatDrawer'
import EmailOutboxDrawer from './EmailOutboxDrawer'

function getNotifMeta(item) {
  const t = (item.title || '').toLowerCase()
  if (t.includes('performance')) return { icon: '📊', color: '#654bd2', bg: '#f0ebff', label: 'Performance' }
  if (t.includes('competency') || t.includes('skill')) return { icon: '🎯', color: '#0284c7', bg: '#e0f2fe', label: 'Competency' }
  if (t.includes('learning')) return { icon: '🎓', color: '#16a34a', bg: '#dcfce7', label: 'Learning' }
  if (t.includes('training')) return { icon: '📅', color: '#d97706', bg: '#fef3c7', label: 'Training' }
  if (t.includes('succession')) return { icon: '👑', color: '#9333ea', bg: '#f3e8ff', label: 'Succession' }
  if (t.includes('recognition')) return { icon: '🏆', color: '#e11d48', bg: '#ffe4e6', label: 'Recognition' }
  return { icon: '🔔', color: '#5e48c0', bg: '#efebff', label: 'Workflow' }
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Header({ user, onToggle, dark }) {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [outboxOpen, setOutboxOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [notifFilter, setNotifFilter] = useState('all')

  const canSeeOutbox = user?.role === 'hr' || user?.role === 'management'

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const result = await api.notifications()
        if (active) {
          setNotifications(result.notifications || [])
          setUnread(result.unread || 0)
        }
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const showNotifications = async () => {
    setOpen(value => !value)
    if (!open && unread > 0) {
      try {
        await api.readNotifications()
        setUnread(0)
        setNotifications(items => items.map(item => ({ ...item, is_read: true })))
      } catch {}
    }
  }

  const markAllRead = async (e) => {
    e.stopPropagation()
    try {
      await api.readNotifications()
      setUnread(0)
      setNotifications(items => items.map(item => ({ ...item, is_read: true })))
    } catch {}
  }

  const displayNotifs = notifFilter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  return <>
    <header className="topbar">
      <div className="crumb">Hospitality HR <span>/</span> Performance &amp; Development</div>
      <div className="top-actions">
        <label className="search"><Icon name="search" size={18}/><input placeholder="Search"/></label>
        <button
          className="header-text-button ai-chat-btn"
          type="button"
          onClick={() => setAiChatOpen(true)}
        >
          ✦ AI Assistant
        </button>
        {canSeeOutbox && (
          <button
            className="header-text-button"
            type="button"
            onClick={() => setOutboxOpen(true)}
            title="Live Email Outbox Inspector"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            📧 Outbox
          </button>
        )}
        <button className="header-text-button"><Icon name="book" size={15}/>Learn</button>
        {user?.role !== 'operations_manager' && <button className="header-text-button"><Icon name="settings" size={15}/>Settings</button>}
        <button className="icon-button notif-bell" onClick={showNotifications} aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}>
          <Icon name="bell" size={18}/>
          {unread > 0 && (
            <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
        <button className="theme-switch" onClick={onToggle} aria-pressed={dark}><span className="theme-thumb">{dark ? 'M' : 'S'}</span></button>
        <span className="avatar avatar-lia">{user?.name ? (user.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() : 'HR'}</span>
      </div>
    </header>

    {/* Professional Notification Panel Dropdown */}
    {open && (
      <>
        <div className="notif-popover-backdrop" onClick={() => setOpen(false)} />
        <div className="notif-panel-box">
          {/* Header */}
          <div className="notif-panel-head">
            <div className="notif-panel-title-wrap">
              <h2>Notifications</h2>
              {unread > 0 && <span className="notif-unread-count-tag">{unread} unread</span>}
            </div>
            <div className="notif-panel-actions">
              {unread > 0 && (
                <button className="notif-btn-text" onClick={markAllRead}>
                  ✓ Mark all read
                </button>
              )}
              <button className="notif-close-icon" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="notif-panel-tabs">
            <button
              className={`notif-tab ${notifFilter === 'all' ? 'active' : ''}`}
              onClick={() => setNotifFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`notif-tab ${notifFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setNotifFilter('unread')}
            >
              Unread ({unread})
            </button>
          </div>

          {/* List Content */}
          <div className="notif-panel-body">
            {displayNotifs.length > 0 ? (
              displayNotifs.map(item => {
                const meta = getNotifMeta(item)
                const isExpanded = expandedId === item.id
                return (
                  <article
                    key={item.id}
                    className={`notif-card-item ${item.is_read ? 'is-read' : 'is-unread'} ${isExpanded ? 'is-expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="notif-card-icon" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="notif-card-main">
                      <div className="notif-card-header">
                        <span className="notif-card-badge" style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                        <span className="notif-card-time">{timeAgo(item.created_at)}</span>
                      </div>
                      <h4 className="notif-card-title">{item.title}</h4>
                      <p className="notif-card-desc">{item.message}</p>

                      {isExpanded && (
                        <div className="notif-card-expanded-details">
                          <div className="notif-detail-block">
                            <span className="notif-detail-lbl">Description &amp; Action Required:</span>
                            <p>{item.message || 'Complete the step required for this workflow process.'}</p>
                          </div>
                          {item.workflow_id && (
                            <div className="notif-detail-block">
                              <span className="notif-detail-lbl">Workflow Reference:</span>
                              <code>#{item.workflow_id.slice(0, 8)}</code>
                            </div>
                          )}
                          <div className="notif-detail-timestamp">
                            Dispatched: {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    {!item.is_read && <span className="notif-unread-blue-dot" />}
                  </article>
                )
              })
            ) : (
              <div className="notif-empty-container">
                <div className="notif-empty-icon">🔕</div>
                <b>{notifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</b>
                <p>Workflow notifications and action items will appear here automatically.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="notif-panel-foot">
            <small>Hospitality HR Personnel System</small>
            <button onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      </>
    )}

    <AIChatDrawer isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    <EmailOutboxDrawer isOpen={outboxOpen} onClose={() => setOutboxOpen(false)} />
  </>
}
