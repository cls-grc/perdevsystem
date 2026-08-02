import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
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
import EmployeeManagement from './pages/EmployeeManagement'
import GoalsManagement from './pages/GoalsManagement'
import Feedback360 from './pages/Feedback360'
import Register from './pages/Register'
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
import './goalsFeedback.css'

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

// Auto-logout after 3 minutes of inactivity
  useEffect(() => {
    if (!user) return
    let timeout
    const IDLE_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes
    const resetTimer = () => {
      clearTimeout(timeout)
      timeout = setTimeout(async () => {
        const refreshToken = localStorage.getItem('pds-refresh-token')
        if (refreshToken) {
          try { await api.logout(refreshToken) } catch { /* best-effort */ }
        }
        localStorage.removeItem('pds-token')
        localStorage.removeItem('pds-refresh-token')
        localStorage.removeItem('pds-user')
        setUser(null)
      }, IDLE_TIMEOUT_MS)
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetTimer))
    resetTimer()
    return () => {
      clearTimeout(timeout)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [user])

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

  // Public route (register) — render without auth wrapper
  if (window.location.pathname === '/register' && !user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Login onLogin={setUser} />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!user) return <Login onLogin={setUser} />

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('pds-refresh-token')
    if (refreshToken) {
      try { await api.logout(refreshToken) } catch { /* best-effort */ }
    }
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    localStorage.removeItem('pds-user')
    setUser(null)
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex text-gray-800 dark:text-gray-100">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="flex-1 min-h-screen flex flex-col">
          <Header user={user} onToggle={() => setDark((s) => !s)} dark={dark} />
          <Routes>
            <Route path="/" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics />:<RoleHome role={user.role} name={user.name}/>} />
            <Route path="/performance" element={<PerformanceManagement />} />
            <Route path="/competency" element={<CompetencyManagement />} />
            <Route path="/learning" element={<LearningManagement />} />
            <Route path="/training" element={<TrainingManagement />} />
            <Route path="/succession" element={['hr','supervisor','management','operations_manager'].includes(user.role)?<SuccessionPlanning />:<RoleHome role={user.role} name={user.name}/>} />
            <Route path="/recognition" element={<SocialRecognition />} />
            <Route path="/certificates" element={['hr', 'employee'].includes(user.role) ? <CertificateManagement /> : <Navigate to="/" replace />} />
<Route path="/employees" element={['hr', 'operations_manager', 'supervisor'].includes(user.role) ? <EmployeeManagement /> : <Navigate to="/" replace />} />
            <Route path="/goals" element={<GoalsManagement />} />
            <Route path="/feedback" element={<Feedback360 />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics />:<RoleHome role={user.role} name={user.name}/>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
