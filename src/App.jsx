import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AIAnalytics from './pages/AIAnalytics'
import PerformanceManagement from './pages/PerformanceManagement'
import CompetencyManagement from './pages/CompetencyManagement'
import LearningManagement from './pages/LearningManagement'
import TrainingManagement from './pages/TrainingManagement'
import SuccessionPlanning from './pages/SuccessionPlanning'
import SocialRecognition from './pages/SocialRecognition'
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

  if (!user) return <Login onLogin={setUser} />

  return (
    <BrowserRouter>
      <div className="min-h-screen flex text-gray-800 dark:text-gray-100">
        <Sidebar user={user} onLogout={() => { localStorage.removeItem('pds-token'); localStorage.removeItem('pds-user'); setUser(null) }} />
        <div className="flex-1 min-h-screen flex flex-col">
          <Header onToggle={() => setDark((s) => !s)} dark={dark} />
          <Routes>
            <Route path="/" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics />:<RoleHome role={user.role} name={user.name}/>} />
            <Route path="/performance" element={<PerformanceManagement />} />
            <Route path="/competency" element={<CompetencyManagement />} />
            <Route path="/learning" element={<LearningManagement />} />
            <Route path="/training" element={<TrainingManagement />} />
            <Route path="/succession" element={['hr','supervisor','management','operations_manager'].includes(user.role)?<SuccessionPlanning />:<RoleHome role={user.role} name={user.name}/>} />
            <Route path="/recognition" element={<SocialRecognition />} />
            <Route path="*" element={['hr','operations_manager'].includes(user.role)?<AIAnalytics />:<RoleHome role={user.role} name={user.name}/>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
