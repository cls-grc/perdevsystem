import React, { useEffect, useState } from 'react'
import { Icon } from './Sidebar'
import { api } from '../lib/api'

export default function Header({ onToggle, dark }) {
  const [notifications, setNotifications] = useState([]); const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false)
  useEffect(() => { let active = true; const load = async () => { try { const result = await api.notifications(); if (active) { setNotifications(result.notifications); setUnread(result.unread) } } catch {} }; load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer) } }, [])
  const showNotifications = async () => { setOpen(value => !value); if (!open) { try { await api.readNotifications(); setUnread(0); setNotifications(items => items.map(item => ({ ...item, is_read: true }))) } catch {} } }
  return <><header className="topbar"><div className="crumb">Hospitality HR <span>/</span> Performance &amp; Development</div><div className="top-actions"><label className="search"><Icon name="search" size={18}/><input placeholder="Search"/></label><button className="header-text-button"><Icon name="book" size={15}/>Learn</button><button className="header-text-button"><Icon name="settings" size={15}/>Settings</button><button className="icon-button" onClick={showNotifications} aria-label="Notifications"><Icon name="bell" size={18}/>{unread > 0 && <i/>}</button><button className="theme-switch" onClick={onToggle} aria-pressed={dark}><span className="theme-thumb">{dark ? 'M' : 'S'}</span></button><span className="avatar avatar-lia">HR</span></div></header>{open && <div className="header-popover notification-popover"><div><h2>Notifications</h2><button onClick={() => setOpen(false)}>×</button></div>{notifications.length ? notifications.map(item => <article key={item.id}><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>) : <p>No workflow notifications yet.</p>}</div>}</>
}
