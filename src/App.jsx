import { lazy, Suspense, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import Header from './components/Header'
import LiveToast from './components/LiveToast'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import './index.css'
import './buttonStyles.css'
import './employeeSearch.css'
import './login.css'
import './moduleAi.css'
import './roleHome.css'
import './roleControls.css'
import './certificate.css'
import './certificateUpload.css'
import './employeeRecords.css'
import Login from './pages/Login'
import './learningLibrary.css'
import './responsive.css'
import './animations.css'
import './darkModeFixes.css'
import './interactiveWorkflow.css'
import AIAnalytics from './pages/AIAnalytics'
import RoleHome from './pages/RoleHome'

// Lazy-load secondary module pages so each is downloaded on-demand
const PerformanceManagement = lazy(() => import('./pages/PerformanceManagement'))
const CompetencyManagement = lazy(() => import('./pages/CompetencyManagement'))
const LearningManagement = lazy(() => import('./pages/LearningManagement'))
const TrainingManagement = lazy(() => import('./pages/TrainingManagement'))
const SuccessionPlanning = lazy(() => import('./pages/SuccessionPlanning'))
const SocialRecognition = lazy(() => import('./pages/SocialRecognition'))
const CertificateManagement = lazy(() => import('./pages/CertificateManagement'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
const EmployeeManagement = lazy(() => import('./pages/EmployeeManagement'))
const OrgChart = lazy(() => import('./pages/OrgChart'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Register = lazy(() => import('./pages/Register'))
const AIChatDrawer = lazy(() => import('./components/AIChatDrawer'))

// Dimension-locked page skeleton matching rendered module geometry
function PageSkeleton() {
  return (
    <div
      className="page-skeleton-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '32px 38px 60px',
        maxWidth: 1420,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        flex: '1 0 auto',
        minHeight: 'calc(100vh - 72px)',
      }}
    >
      {/* Header bar shimmer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, marginBottom: 4 }}>
        <div>
          <div className="skeleton-bar" style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton-bar" style={{ width: 240, height: 26, borderRadius: 8 }} />
        </div>
        <div className="skeleton-bar" style={{ width: 120, height: 38, borderRadius: 8 }} />
      </div>
      {/* 5 KPI Stat cards shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-bar" style={{ height: 120, borderRadius: 12 }} />
        ))}
      </div>
      {/* Middle content / chart shimmer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div className="skeleton-bar" style={{ height: 280, borderRadius: 14 }} />
        <div className="skeleton-bar" style={{ height: 280, borderRadius: 14 }} />
      </div>
      {/* Bottom table shimmer */}
      <div className="skeleton-bar" style={{ height: 180, borderRadius: 14 }} />
    </div>
  )
}

// Module and page content router with smooth animated transition on route change
function ModuleRoutes({ user }) {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const mainEl = document.querySelector('.fixed-main')
    if (mainEl) mainEl.scrollTop = 0
  }, [location.pathname])

  // Eagerly preload all lazy page chunks right after the app shell renders
  // so every sidebar navigation is instant (chunks already in browser cache)
  useEffect(() => {
    const t = setTimeout(() => {
      import('./pages/PerformanceManagement')
      import('./pages/CompetencyManagement')
      import('./pages/LearningManagement')
      import('./pages/TrainingManagement')
      import('./pages/SuccessionPlanning')
      import('./pages/SocialRecognition')
      import('./pages/OrgChart')
      import('./pages/CertificateManagement')
      import('./pages/EmployeeManagement')
      import('./pages/AuditLogs')
      import('./components/AIChatDrawer')
    }, 1500) // 1.5s after mount — let the current page render first
    return () => clearTimeout(t)
  }, []) // only once

  return (
    <div key={location.pathname} className="page-transition-wrapper">
      <Suspense fallback={<PageSkeleton />}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              ['hr', 'operations_manager'].includes(user.role) ? (
                <AIAnalytics key={`analytics-${user.id}`} />
              ) : (
                <RoleHome key={`home-${user.id}`} role={user.role} name={user.name} />
              )
            }
          />
          <Route path="/performance" element={<PerformanceManagement key={`perf-${user.id}`} />} />
          <Route path="/competency" element={<CompetencyManagement key={`comp-${user.id}`} />} />
          <Route path="/learning" element={<LearningManagement key={`learn-${user.id}`} />} />
          <Route path="/training" element={<TrainingManagement key={`train-${user.id}`} />} />
          <Route
            path="/succession"
            element={
              ['hr', 'supervisor', 'management', 'operations_manager'].includes(user.role) ? (
                <SuccessionPlanning key={`succ-${user.id}`} />
              ) : (
                <RoleHome key={`home-${user.id}`} role={user.role} name={user.name} />
              )
            }
          />
          <Route path="/recognition" element={<SocialRecognition key={`recog-${user.id}`} />} />
          <Route path="/orgchart" element={<OrgChart key={`org-${user.id}`} />} />
          <Route
            path="/certificates"
            element={
              ['hr', 'employee', 'supervisor', 'operations_manager'].includes(user.role) ? (
                <CertificateManagement key={`cert-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/employees"
            element={
              ['hr', 'operations_manager', 'supervisor'].includes(user.role) ? (
                <EmployeeManagement key={`emp-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/audit"
            element={
              ['hr', 'operations_manager', 'management'].includes(user.role) ? (
                <AuditLogs key={`audit-${user.id}`} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pds-user') || 'null') } catch { return null }
  })
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('pds-theme') === 'dark'
    } catch {
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
    } catch (err) { void err }
  }, [dark])

  const handleLogout = (reason = '') => {
    // Guard: if called directly as an onClick handler, reason will be a MouseEvent — ignore it
    const noticeMsg = typeof reason === 'string' ? reason : ''
    const refreshToken = localStorage.getItem('pds-refresh-token')
    if (refreshToken) {
      void api.logout(refreshToken).catch(() => {})
    }
    try {
      const currentUser = JSON.parse(localStorage.getItem('pds-user') || '{}') || {}
      if (currentUser?.id) localStorage.removeItem(`pds-ai-chat-${currentUser.id}`)
    } catch { /* best-effort */ }
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    localStorage.removeItem('pds-user')
    localStorage.removeItem('pds-last-activity')

    // Store session notice across the reload if one was provided
    if (noticeMsg) {
      try { sessionStorage.setItem('pds-session-notice', noticeMsg) } catch (err) { void err }
    }

    // Hard-navigate to root so Login always mounts fresh with no stale app shell
    window.location.replace('/')
  }

  // 10-minute session inactivity auto-logout (adjusted for defense & presentation)
  useEffect(() => {
    if (!user) return

    const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
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
        handleLogout('You have been logged out due to 10 minutes of inactivity.')
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity))
      clearInterval(intervalId)
    }
  }, [user])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route: Certificate verification */}
        <Route path="/verify/certificate/:verificationCode" element={
          <Suspense fallback={<PageSkeleton />}>
            <CertificateVerification />
          </Suspense>
        } />

        {/* Public route: Register with invitation token */}
        <Route
          path="/register"
          element={
            <Suspense fallback={<PageSkeleton />}>
              {!user ? <Register /> : <Navigate to="/" replace />}
            </Suspense>
          }
        />

        {/* Main application or Login fallback */}
        <Route
          path="/*"
          element={
            !user ? (
              <Login
                onLogin={(u) => {
                  setSessionNotice('')
                  setUser(u)
                }}
                notice={sessionNotice}
              />
            ) : (
              <div className="min-h-screen flex text-gray-800 dark:text-gray-100">
                <Sidebar key={`sb-${user.id}`} user={user} onLogout={handleLogout} onOpenAiChat={() => setAiChatOpen(true)} />
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
                  <ModuleRoutes user={user} />
                </div>
              </div>
            )
          }
        />
      </Routes>

      {/* Global AI Chat Drawer — persists across all pages when authenticated */}
      {user && (
        <Suspense fallback={null}>
          <AIChatDrawer
            isOpen={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
            onOpen={() => setAiChatOpen(true)}
          />
        </Suspense>
      )}

      {/* Global Live Toast — polls for new notifications and surfaces them as toasts */}
      {user && <LiveToast />}
    </BrowserRouter>
  )
}

export default App
