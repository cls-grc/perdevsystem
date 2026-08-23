import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { api } from './lib/api'
import AIAnalytics from './pages/AIAnalytics'
import PerformanceManagement from './pages/PerformanceManagement'
import CompetencyManagement from './pages/CompetencyManagement'
import LearningManagement from './pages/LearningManagement'
import TrainingManagement from './pages/TrainingManagement'
import SuccessionPlanning from './pages/SuccessionPlanning'
import SocialRecognition from './pages/SocialRecognition'
import CertificateManagement from './pages/CertificateManagement'
import CertificateVerification from './pages/CertificateVerification'
import EmployeeManagement from './pages/EmployeeManagement'
import AuditLogs from './pages/AuditLogs'
import Register from './pages/Register'
import AIChatDrawer from './components/AIChatDrawer'
import './index.css'
import './buttonStyles.css'
import './employeeSearch.css'
import './darkModeFixes.css'
import './login.css'
import './moduleAi.css'
import Login from './pages/Login'
import RoleHome from './pages/RoleHome'
import './roleHome.css'
import './roleControls.css'
import './certificate.css'
import './certificateUpload.css'
import './employeeRecords.css'
import './learningLibrary.css'
import './responsive.css'

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pds-user') || 'null') } catch { return null }
  })
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('pds-theme') === 'dark'
    } catch (e) {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [sessionNotice, setSessionNotice] = useState('')

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('pds-theme', dark ? 'dark' : 'light')
    } catch (e) {}
  }, [dark])

  const handleLogout = async (reason = '') => {
    const refreshToken = localStorage.getItem('pds-refresh-token')
    if (refreshToken) {
      try { await api.logout(refreshToken) } catch { /* best-effort */ }
    }
    try {
      const currentUser = JSON.parse(localStorage.getItem('pds-user') || '{}') || {}
      if (currentUser.id) localStorage.removeItem(`pds-ai-chat-${currentUser.id}`)
    } catch { /* best-effort */ }
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    localStorage.removeItem('pds-user')
    localStorage.removeItem('pds-last-activity')
    setUser(null)
    if (reason) {
      setSessionNotice(reason)
    }
  }

  // 3-minute session inactivity auto-logout
  useEffect(() => {
    if (!user) return

    const TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes
    const CHECK_INTERVAL_MS = 3000 // check every 3 seconds

    const updateActivity = () => {
      localStorage.setItem('pds-last-activity', String(Date.now()))
    }

    // Set initial activity timestamp on mount / login
    updateActivity()

    let lastRecorded = Date.now()
    const handleUserActivity = () => {
      const now = Date.now()
      if (now - lastRecorded > 1000) {
        lastRecorded = now
        updateActivity()
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((event) => window.addEventListener(event, handleUserActivity, { passive: true }))

    const intervalId = setInterval(() => {
      const lastActivity = Number(localStorage.getItem('pds-last-activity') || Date.now())
      if (Date.now() - lastActivity >= TIMEOUT_MS) {
        handleLogout('You have been logged out due to 3 minutes of inactivity.')
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity))
      clearInterval(intervalId)
    }
  }, [user])

  // Public route (certificate verification) — render without auth wrapper when unauthenticated
  if (window.location.pathname.startsWith('/verify/certificate/')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/verify/certificate/:verificationCode" element={<CertificateVerification />} />
          <Route path="*" element={<CertificateVerification />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Public route (register) — render without auth wrapper
  if (window.location.pathname === '/register' && !user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Login onLogin={(u) => { setSessionNotice(''); setUser(u) }} notice={sessionNotice} />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!user) return <Login onLogin={(u) => { setSessionNotice(''); setUser(u) }} notice={sessionNotice} />

  return (
    <BrowserRouter>
      <div className="min-h-screen flex text-gray-800 dark:text-gray-100">
        <Sidebar key={`sb-${user.id}`} user={user} onLogout={handleLogout} />
        <div className="flex-1 min-h-screen flex flex-col fixed-main">
          <Header
            key={`hdr-${user.id}`}
            user={user}
            onToggle={() => setDark((s) => !s)}
            dark={dark}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenAiChat={() => setAiChatOpen(true)}
          />
          <MobileNav user={user} onLogout={handleLogout} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
          <Routes>
            <Route path="/" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics key={`analytics-${user.id}`} />:<RoleHome key={`home-${user.id}`} role={user.role} name={user.name}/>} />
            <Route path="/performance" element={<PerformanceManagement key={`perf-${user.id}`} />} />
            <Route path="/competency" element={<CompetencyManagement key={`comp-${user.id}`} />} />
            <Route path="/learning" element={<LearningManagement key={`learn-${user.id}`} />} />
            <Route path="/training" element={<TrainingManagement key={`train-${user.id}`} />} />
            <Route path="/succession" element={['hr','supervisor','management','operations_manager'].includes(user.role)?<SuccessionPlanning key={`succ-${user.id}`} />:<RoleHome key={`home-${user.id}`} role={user.role} name={user.name}/>} />
            <Route path="/recognition" element={<SocialRecognition key={`recog-${user.id}`} />} />
            <Route path="/certificates" element={['hr', 'employee', 'supervisor', 'operations_manager'].includes(user.role) ? <CertificateManagement key={`cert-${user.id}`} /> : <Navigate to="/" replace />} />
            <Route path="/verify/certificate/:verificationCode" element={<CertificateVerification key={`verify-${user.id}`} />} />
            <Route path="/employees" element={['hr', 'operations_manager', 'supervisor'].includes(user.role) ? <EmployeeManagement key={`emp-${user.id}`} /> : <Navigate to="/" replace />} />
            <Route path="/audit" element={['hr', 'operations_manager', 'management'].includes(user.role) ? <AuditLogs key={`audit-${user.id}`} /> : <Navigate to="/" replace />} />
            <Route path="/register" element={<Register key={`reg-${user.id}`} />} />
            <Route path="*" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics key={`analytics-${user.id}`} />:<RoleHome key={`home-${user.id}`} role={user.role} name={user.name}/>} />
          </Routes>
        </div>
      </div>
      {/* Global AI Chat Drawer — persists across ALL pages/modules */}
      <AIChatDrawer
        isOpen={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        onOpen={() => setAiChatOpen(true)}
      />
    </BrowserRouter>
  )
}

export default App
