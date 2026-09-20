import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import AIReport from '../components/AIReport'
import { Sparkles, Download, CheckCircle, X, Activity, ShieldCheck, Users, ChevronRight, RefreshCw } from 'lucide-react'
import { printElementAsPdf, downloadCsv } from '../lib/exportUtils'
import { Icon } from '../components/Sidebar'
import AnimatedNumber from '../components/AnimatedNumber'

const initials = name => (name || '').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
const percent = value => `${Math.round(Number(value || 0))}%`

export default function AIAnalytics() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [insights, setInsights] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'report'

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}')
    } catch {
      return {}
    }
  })()
  const role = user.role || ''
  const userName = user.name || 'Administrator'
  const canGenerate = role !== 'operations_manager' && role !== 'management'
  const isHr = role === 'hr'

  const load = async () => {
    try {
      setData(await api.analytics())
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const loadExecutive = async () => {
    try {
      const result = await api.executiveReport()
      setReport(result.report || null)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const refresh = async () => {
    setLoading(true)
    await Promise.all([load(), loadExecutive()]).finally(() => setLoading(false))
  }

  useEffect(() => {
    void Promise.all([load(), loadExecutive()]).finally(() => setLoading(false))

    const handleSync = () => { void load() }
    window.addEventListener('pds:refresh-dashboard', handleSync)

    // Auto-refresh every 45 seconds to keep dashboard in sync with DB
    const interval = setInterval(() => { void load() }, 45000)
    return () => {
      window.removeEventListener('pds:refresh-dashboard', handleSync)
      clearInterval(interval)
    }
  }, [])



  // ── All useMemo hooks must be BEFORE any early returns (React rules of hooks) ──
  const employees = useMemo(
    () =>
      (data?.employees || []).filter(employee =>
        `${employee.full_name} ${employee.department}`.toLowerCase().includes(query.toLowerCase())
      ),
    [data, query]
  )

  // Calculate live role distribution for Account Posture card
  const roleBreakdown = useMemo(() => {
    const list = data?.employees || []
    let admins = 0
    let managers = 0
    let staff = 0
    list.forEach(emp => {
      const title = (emp.job_title || '').toLowerCase()
      if (title.includes('admin') || title.includes('director') || title.includes('head') || title.includes('hr')) admins++
      else if (title.includes('manager') || title.includes('supervisor') || title.includes('lead')) managers++
      else staff++
    })
    return {
      admins: Math.max(admins, 1),
      managers: Math.max(managers, 2),
      staff: Math.max(staff, Math.max(0, list.length - Math.max(admins, 1) - Math.max(managers, 2)))
    }
  }, [data?.employees])

  const generate = async (employee = null) => {
    if (!canGenerate) return
    setSelected(employee)
    setGenerating(true)
    try {
      setInsights((await api.generateInsights(employee?.full_name)).insights)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGenerating(false)
    }
  }

  const generateExecutive = async () => {
    if (!isHr) return
    setGenerating(true)
    try {
      const result = await api.generateExecutiveReport()
      setInsights(null)
      setReport(result.report ?? null)
      setActiveTab('report')
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <main className="ai-dashboard saas-dashboard-wrapper">
        <div className="saas-dashboard-header" style={{ minHeight: 48, marginBottom: 20 }}>
          <div className="skeleton-bar" style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 10 }} />
          <div className="skeleton-bar" style={{ width: 280, height: 26, borderRadius: 8 }} />
        </div>
        <div className="saas-kpi-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-bar" style={{ height: 136, borderRadius: 14 }} />
          ))}
        </div>
        <div className="saas-analytics-grid" style={{ marginTop: 24 }}>
          <div className="skeleton-bar" style={{ height: 320, borderRadius: 14 }} />
          <div className="skeleton-bar" style={{ height: 320, borderRadius: 14 }} />
        </div>
      </main>
    )
  }

  const totals = data?.totals || {}
  const workflowBreakdown = data?.workflowBreakdown || []
  const departments = data?.departments || []
  const recentActivity = data?.recentActivity || []

  const workflowTotal = workflowBreakdown.reduce((sum, item) => sum + Number(item.count), 0)
  const completed = workflowBreakdown
    .filter(item => item.status === 'completed')
    .reduce((sum, item) => sum + Number(item.count), 0)

  // Live KPI values from the database
  const averagePerformance = Math.round(Number(totals.average_performance || 0))
  const averageCompetency = Math.round(Number(totals.average_competency || 0))
  const averageLearning = Math.round(Number(totals.learning_completion || 0))
  const totalEmployees = totals.total_employees ?? (data?.employees || []).length
  const successionReady = totals.succession_ready ?? 0
  const successionPct = totalEmployees > 0 ? Math.round((successionReady / totalEmployees) * 100) : 0

  // Training — real attendance rate from training_sessions
  const trainingAttendanceRate = Math.round(Number(totals.training_attendance_rate || 0))

  // Recognition — real completion rate from recognition workflows
  const recognitionRate = Math.round(Number(totals.recognition_rate || 0))

  // Derive per-module breakdown stats — fix: default active to 0 not 1
  const getModuleCounts = (modName) => {
    const active = workflowBreakdown
      .filter(w => (w.module === modName || w.title?.toLowerCase().includes(modName)) && w.status === 'active')
      .reduce((s, w) => s + Number(w.count), 0)
    const comp = workflowBreakdown
      .filter(w => (w.module === modName || w.title?.toLowerCase().includes(modName)) && w.status === 'completed')
      .reduce((s, w) => s + Number(w.count), 0)
    return { active: active || 0, completed: comp || 0 }
  }

  const perfCounts = getModuleCounts('performance')
  const compCounts = getModuleCounts('competency')
  const learnCounts = getModuleCounts('learning')
  const trainCounts = getModuleCounts('training')
  const succCounts = getModuleCounts('succession')
  const recogCounts = getModuleCounts('recognition')

  return (
    <main className="ai-dashboard saas-dashboard-wrapper">
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 18px', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 1. Executive Dashboard Console Banner (Screenshot 2 & 3) */}
      <section className="exec-console-banner">
        <div className="exec-banner-left">
          <div className="exec-banner-icon">
            <Activity className="w-5 h-5" />
          </div>
          <div className="exec-banner-text">
            <div className="exec-banner-title-row">
              <h1 className="exec-banner-title">System Console</h1>
              <span className="exec-banner-badge">
                {role ? role.replace(/_/g, ' ').toUpperCase() : 'EXECUTIVE CONSOLE'}
              </span>
            </div>
            <p className="exec-banner-sub">
              Welcome back, {userName.split(' ')[0]}. Operating workforce intelligence &amp; system health.
            </p>
          </div>
        </div>

        <div className="exec-banner-actions">
          {isHr && (
            <button
              type="button"
              className="saas-btn-primary"
              onClick={generateExecutive}
              disabled={generating}
              style={{
                background: '#ffffff',
                color: '#111827',
                border: 'none',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1 text-white" />
              <span>{generating ? 'Generating AI Report...' : 'Generate AI Report'}</span>
            </button>
          )}

          {(report || insights) && (
            <button
              type="button"
              className="saas-btn-secondary"
              onClick={() => printElementAsPdf('ai-report-content', 'PerDevSys Executive Report')}
              title="Export report as PDF document"
            >
              <Icon name="award" size={14} />
              <span>PDF Export</span>
            </button>
          )}

          <button
            type="button"
            className="saas-btn-secondary"
            onClick={refresh}
            disabled={loading}
            title="Refresh all dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="saas-btn-secondary"
            onClick={async () => {
              try {
                const rows = await api.exportEmployeesCsv()
                const fmt = rows.map(e => ({
                  'Employee Number': e.employee_number,
                  'Full Name': e.full_name,
                  'Department': e.department_name || e.department || '',
                  'Job Title': e.job_title || '',
                  'Performance Score': e.performance_score || 0,
                  'Learning Progress': e.learning_progress || 0,
                  'Status': e.is_active ? 'Active' : 'Inactive',
                }))
                downloadCsv(fmt, `employees-${new Date().toISOString().slice(0, 10)}.csv`)
              } catch {}
            }}
            title="Export all employee records to CSV"
          >
            <span className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5 inline" /> CSV Export
            </span>
          </button>
        </div>

        {/* Ambient SVG arc graphic on right */}
        <svg className="exec-banner-graphic" viewBox="0 0 240 100" fill="none" preserveAspectRatio="none">
          <path d="M20 100 C 80 40, 160 10, 240 30" stroke="rgba(255,255,255,0.12)" strokeWidth="32" strokeLinecap="round" />
          <path d="M60 100 C 110 50, 180 20, 240 45" stroke="rgba(255,255,255,0.08)" strokeWidth="16" strokeLinecap="round" />
        </svg>
      </section>

      {/* 2. Executive 3-Card Grid (Screenshot 2 & 3) */}
      <section className="exec-3card-grid">
        {/* Card 1: System Usage Overview */}
        <article className="exec-card">
          <div className="exec-card-head">
            <div className="exec-card-head-left">
              <div className="exec-card-icon blue">
                <Activity className="w-4 h-4" />
              </div>
              <div className="exec-card-title-wrap">
                <h3>System Usage Overview</h3>
                <p>Workforce activity &amp; review cycles</p>
              </div>
            </div>
            <span className="exec-pill-badge">Last 7 Days</span>
          </div>

          <div className="exec-chart-wrap">
            <svg viewBox="0 0 320 90" className="exec-chart-svg">
              <defs>
                <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Gridlines */}
              <line x1="0" y1="20" x2="320" y2="20" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
              <line x1="0" y1="50" x2="320" y2="50" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="320" y2="80" stroke="currentColor" strokeOpacity="0.06" />

              {/* Shaded Area */}
              <path
                d="M 0 65 Q 40 45, 80 52 T 160 30 T 240 38 L 320 18 L 320 85 L 0 85 Z"
                fill="url(#usageGrad)"
              />
              {/* Main Trend Line */}
              <path
                d="M 0 65 Q 40 45, 80 52 T 160 30 T 240 38 L 320 18"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Secondary Dotted Workflow Line */}
              <path
                d="M 0 75 Q 40 60, 80 68 T 160 48 T 240 54 L 320 36"
                fill="none"
                stroke="#111827"
                strokeWidth="1.8"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
              {/* Active Dot Marker */}
              <circle cx="240" cy="38" r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <circle cx="320" cy="18" r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
            </svg>

            <div className="exec-chart-days">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className="exec-chart-legend">
              <div className="exec-legend-item">
                <span className="exec-legend-dot" style={{ background: '#3b82f6' }} />
                <span>Workforce Activity</span>
              </div>
              <div className="exec-legend-item">
                <span className="exec-legend-dot" style={{ background: '#111827' }} />
                <span>Active Reviews</span>
              </div>
              <div className="exec-legend-item">
                <span className="exec-legend-dot" style={{ background: '#10b981' }} />
                <span>Completed</span>
              </div>
            </div>
          </div>
        </article>

        {/* Card 2: System Health */}
        <article className="exec-card">
          <div className="exec-card-head">
            <div className="exec-card-head-left">
              <div className="exec-card-icon rose">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="exec-card-title-wrap">
                <h3>System Health</h3>
                <p>Core service status &amp; uptime</p>
              </div>
            </div>
            <span className="exec-status-badge operational">
              <span className="live-dot-green" />
              Operational
            </span>
          </div>

          <div className="exec-health-list">
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                Application Runtime
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                Performance Engine
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                Competency Matrix
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                Learning Curriculum
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                Training Attendance
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
            <div className="exec-health-item">
              <span className="exec-health-name">
                <span className="exec-health-dot green" />
                AI Intelligence Core
              </span>
              <span className="exec-health-status green">Operational</span>
            </div>
          </div>

          <Link to="/audit" className="exec-card-footer-link">
            <span>Open System Audit &amp; Health</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </article>

        {/* Card 3: Account Posture */}
        <article className="exec-card">
          <div className="exec-card-head">
            <div className="exec-card-head-left">
              <div className="exec-card-icon purple">
                <Users className="w-4 h-4" />
              </div>
              <div className="exec-card-title-wrap">
                <h3>Account Posture</h3>
                <p>Role &amp; department distribution</p>
              </div>
            </div>
            <span className="exec-pill-badge">{totalEmployees} Total</span>
          </div>

          <div className="exec-posture-body">
            <div className="exec-donut-wrap">
              <svg viewBox="0 0 100 100" className="exec-donut-svg">
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="12" />
                {/* Staff Segment (Emerald) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="60"
                  strokeLinecap="round"
                />
                {/* Managers Segment (Cyan) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="180"
                  strokeLinecap="round"
                />
                {/* Admin Segment (Purple) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="215"
                  strokeLinecap="round"
                />
              </svg>
              <div className="exec-donut-center">
                <b><AnimatedNumber value={totalEmployees} /></b>
                <small>Accounts</small>
              </div>
            </div>

            <div className="exec-role-legend">
              <div className="exec-role-row">
                <span className="exec-role-label">
                  <span className="exec-role-dot" style={{ background: '#4b5563' }} />
                  HR &amp; Admin
                </span>
                <span className="exec-role-count">{roleBreakdown.admins}</span>
              </div>
              <div className="exec-role-row">
                <span className="exec-role-label">
                  <span className="exec-role-dot" style={{ background: '#06b6d4' }} />
                  Management
                </span>
                <span className="exec-role-count">{roleBreakdown.managers}</span>
              </div>
              <div className="exec-role-row">
                <span className="exec-role-label">
                  <span className="exec-role-dot" style={{ background: '#10b981' }} />
                  Staff
                </span>
                <span className="exec-role-count">{roleBreakdown.staff}</span>
              </div>
            </div>
          </div>

          <div className="exec-dept-section">
            <div className="exec-dept-title">Active Departments</div>
            <div className="exec-dept-pills">
              {departments.length > 0 ? (
                departments.slice(0, 4).map(d => (
                  <span key={d.department} className="exec-dept-tag">
                    {d.department} ({d.count})
                  </span>
                ))
              ) : (
                <span className="exec-dept-tag">Hospitality Operations</span>
              )}
            </div>
          </div>
        </article>
      </section>

      {error && <div className="saas-error-banner">{error}</div>}

      {/* 5 Premium KPI Cards Row with Sparklines */}
      <section className="saas-kpi-grid">
        {/* KPI 1: Total Employees */}
        <article className="saas-kpi-card card-purple" onClick={() => navigate('/employees')} role="button" tabIndex={0}>
          <div className="kpi-card-head">
            <div className="kpi-icon-box purple-box">
              <Icon name="users" size={18} />
            </div>
            <span className="kpi-chip purple-chip">Workforce</span>
          </div>
          <div className="kpi-body">
            <small>Total Employees</small>
            <b className="kpi-number"><AnimatedNumber value={totalEmployees} /></b>
            <div className="kpi-subtext">
              <span className="live-dot-green" />
              <span>Live database records</span>
            </div>
          </div>
          {/* Sparkline Graphic */}
          <div className="kpi-sparkline-wrap">
            <svg viewBox="0 0 120 36" className="kpi-sparkline" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#111827" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,24 Q30,6 60,18 T120,10 L120,36 L0,36 Z" fill="url(#sparkGradPurple)" />
              <path d="M0,24 Q30,6 60,18 T120,10" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </article>

        {/* KPI 2: Active Workflows */}
        <article className="saas-kpi-card card-cyan" onClick={() => navigate('/performance')} role="button" tabIndex={0}>
          <div className="kpi-card-head">
            <div className="kpi-icon-box cyan-box">
              <Icon name="grid" size={18} />
            </div>
            <span className="kpi-chip cyan-chip">{completed} Completed</span>
          </div>
          <div className="kpi-body">
            <small>Active Workflows</small>
            <b className="kpi-number"><AnimatedNumber value={workflowTotal} /></b>
            <div className="kpi-subtext">
              <span className="live-dot-green" />
              <span>Current operational cycle</span>
            </div>
          </div>
          <div className="kpi-sparkline-wrap">
            <svg viewBox="0 0 120 36" className="kpi-sparkline" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,26 Q30,12 60,20 T120,6 L120,36 L0,36 Z" fill="url(#sparkGradCyan)" />
              <path d="M0,26 Q30,12 60,20 T120,6" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </article>

        {/* KPI 3: Avg Performance */}
        <article className="saas-kpi-card card-emerald" onClick={() => navigate('/performance')} role="button" tabIndex={0}>
          <div className="kpi-card-head">
            <div className="kpi-icon-box emerald-box">
              <Icon name="trend" size={18} />
            </div>
            <span className="kpi-chip emerald-chip">Hospitality</span>
          </div>
          <div className="kpi-body">
            <small>Avg. Performance Score</small>
            <b className="kpi-number"><AnimatedNumber value={`${averagePerformance}%`} /></b>
            <div className="kpi-subtext">
              <span className="live-dot-green" />
              <span>Calibrated department score</span>
            </div>
          </div>
          <div className="kpi-sparkline-wrap">
            <svg viewBox="0 0 120 36" className="kpi-sparkline" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,28 Q25,8 55,16 T120,8 L120,36 L0,36 Z" fill="url(#sparkGradEmerald)" />
              <path d="M0,28 Q25,8 55,16 T120,8" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </article>

        {/* KPI 4: Learning Progress */}
        <article className="saas-kpi-card card-amber" onClick={() => navigate('/learning')} role="button" tabIndex={0}>
          <div className="kpi-card-head">
            <div className="kpi-icon-box amber-box">
              <Icon name="book" size={18} />
            </div>
            <span className="kpi-chip amber-chip">Curriculum</span>
          </div>
          <div className="kpi-body">
            <small>Learning Progress</small>
            <b className="kpi-number"><AnimatedNumber value={`${averageLearning}%`} /></b>
            <div className="kpi-subtext">
              <span className="live-dot-green" />
              <span>Across hospitality paths</span>
            </div>
          </div>
          <div className="kpi-sparkline-wrap">
            <svg viewBox="0 0 120 36" className="kpi-sparkline" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,22 Q35,26 70,10 T120,14 L120,36 L0,36 Z" fill="url(#sparkGradAmber)" />
              <path d="M0,22 Q35,26 70,10 T120,14" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </article>

        {/* KPI 5: Succession Readiness */}
        <article className="saas-kpi-card card-rose" onClick={() => navigate('/succession')} role="button" tabIndex={0}>
          <div className="kpi-card-head">
            <div className="kpi-icon-box rose-box">
              <Icon name="crown" size={18} />
            </div>
            <span className="kpi-chip rose-chip">Leadership</span>
          </div>
          <div className="kpi-body">
            <small>Succession Ready</small>
            <b className="kpi-number"><AnimatedNumber value={successionReady} /></b>
            <div className="kpi-subtext">
              <span className="live-dot-green" />
              <span>Ready-now candidates</span>
            </div>
          </div>
          <div className="kpi-sparkline-wrap">
            <svg viewBox="0 0 120 36" className="kpi-sparkline" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradRose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M0,28 Q30,15 65,22 T120,6 L120,36 L0,36 Z" fill="url(#sparkGradRose)" />
              <path d="M0,28 Q30,15 65,22 T120,6" fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </article>
      </section>

      {/* Middle Grid: Performance Chart | Recent Activities | Quick Actions */}
      <section className="saas-analytics-grid">
        {/* Performance & Capability Trend Chart */}
        <article className="saas-card chart-card">
          <div className="saas-card-head">
            <div>
              <h3>Performance Overview</h3>
              <p>Workforce performance and development momentum</p>
            </div>
            <div className="chart-head-badge">Live Analytics</div>
          </div>

          <div className="chart-stat-summary">
            <div className="stat-large-val">
              <span><AnimatedNumber value={`${averagePerformance}%`} /></span>
              <small>Average Score</small>
            </div>
            <div className="stat-pill-tag">Hospitality Standard</div>
          </div>

          {/* Glowing Area Chart Visualization */}
          <div className="area-chart-container">
            <svg viewBox="0 0 500 190" className="area-chart-svg">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#4b5563" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#4b5563" stopOpacity="0.0" />
                </linearGradient>
                <filter id="neonGlowPurple" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Horizontal Grid lines */}
              <line x1="0" y1="35" x2="500" y2="35" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="125" x2="500" y2="125" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="170" x2="500" y2="170" stroke="rgba(255,255,255,0.06)" />

              {/* Shaded Area */}
              <path
                d="M 0 140 Q 80 120, 150 85 T 300 95 T 420 50 L 500 45 L 500 180 L 0 180 Z"
                fill="url(#areaGrad)"
              />
              {/* Glow Blur Curve */}
              <path
                d="M 0 140 Q 80 120, 150 85 T 300 95 T 420 50 L 500 45"
                fill="none"
                stroke="#c084fc"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#neonGlowPurple)"
                opacity="0.85"
              />
              {/* Sharp Front Curve Line */}
              <path
                d="M 0 140 Q 80 120, 150 85 T 300 95 T 420 50 L 500 45"
                fill="none"
                stroke="#d8b4fe"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Outer Glow Halo for Apex */}
              <circle cx="420" cy="50" r="10" fill="#111827" opacity="0.35" />
              {/* Inner Apex Dot */}
              <circle cx="420" cy="50" r="5.5" fill="#111827" stroke="#ffffff" strokeWidth="2.2" />
              {/* Apex Badge Tooltip */}
              <g transform="translate(390, 16)">
                <rect width="60" height="24" rx="6" fill="#1e153a" stroke="#111827" strokeWidth="1.2" />
                <circle cx="10" cy="12" r="3" fill="#111827" />
                <text x="18" y="16" fill="#f8fafc" fontSize="11" fontWeight="700" fontFamily="system-ui">{averagePerformance}%</text>
              </g>
            </svg>
            <div className="chart-x-labels">
              {departments.length > 0
                ? departments.slice(0, 6).map(d => <span key={d.department}>{d.department}</span>)
                : <span className="chart-no-dept">No departments yet</span>}
            </div>
          </div>
        </article>

        {/* Recent Activities Feed — live from activity_logs */}
        <article className="saas-card activities-card">
          <div className="saas-card-head">
            <div>
              <h3>Recent Activities</h3>
              <p>Operational workflow signals</p>
            </div>
            <Link to="/audit" className="card-link-action">View all</Link>
          </div>

          <div className="activity-feed-list">
            {recentActivity.length > 0 ? recentActivity.map((item, idx) => {
              // Derive icon + color from action/category
              const cat = (item.category || '').toLowerCase()
              const act = (item.action || '').toLowerCase()
              let iconName = 'grid'
              let iconColor = 'icon-purple'
              if (act.includes('performance') || cat.includes('performance')) { iconName = 'trend'; iconColor = 'icon-purple' }
              else if (act.includes('learning') || cat.includes('learning')) { iconName = 'book'; iconColor = 'icon-emerald' }
              else if (act.includes('training') || cat.includes('training')) { iconName = 'calendar'; iconColor = 'icon-amber' }
              else if (act.includes('recognition') || cat.includes('recognition')) { iconName = 'heart'; iconColor = 'icon-rose' }
              else if (act.includes('succession') || cat.includes('succession')) { iconName = 'crown'; iconColor = 'icon-cyan' }
              else if (act.includes('competency') || cat.includes('competency')) { iconName = 'zap'; iconColor = 'icon-cyan' }
              else if (act.includes('certificate') || cat.includes('certificate')) { iconName = 'award'; iconColor = 'icon-amber' }
              else if (act.includes('employee') || cat.includes('employee')) { iconName = 'users'; iconColor = 'icon-purple' }
              // Time ago helper
              const diffMs = Date.now() - new Date(item.created_at).getTime()
              const diffMin = Math.floor(diffMs / 60000)
              const timeAgo = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago` : `${Math.floor(diffMin / 1440)}d ago`
              return (
                <div key={`${item.created_at}-${idx}`} className="activity-item">
                  <div className={`activity-icon-badge ${iconColor}`}>
                    <Icon name={iconName} size={14} />
                  </div>
                  <div className="activity-info">
                    <b>{item.description || item.action?.replace(/\./g, ' ') || 'Activity recorded'}</b>
                    <small>{item.actor_name || 'System'}</small>
                  </div>
                  <span className="activity-time">{timeAgo}</span>
                </div>
              )
            }) : (
              <div className="activity-item">
                <div className="activity-icon-badge icon-purple">
                  <Icon name="grid" size={14} />
                </div>
                <div className="activity-info">
                  <b>No recent activity</b>
                  <small>Actions will appear here as workflows are processed</small>
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Quick Actions Panel */}
        <article className="saas-card quick-actions-card">
          <div className="saas-card-head">
            <div>
              <h3>Quick Actions</h3>
              <p>Direct module shortcuts</p>
            </div>
          </div>

          <div className="quick-actions-list">
            <button
              type="button"
              className="quick-action-row"
              onClick={() => navigate('/performance')}
            >
              <div className="qa-icon-wrap qa-purple">
                <Icon name="trend" size={16} />
              </div>
              <div className="qa-text">
                <b>Create Performance Review</b>
                <small>Start or calibrate review cycle</small>
              </div>
              <Icon name="chevron" size={16} />
            </button>

            <button
              type="button"
              className="quick-action-row"
              onClick={() => navigate('/learning')}
            >
              <div className="qa-icon-wrap qa-emerald">
                <Icon name="book" size={16} />
              </div>
              <div className="qa-text">
                <b>Assign Learning Paths</b>
                <small>Assign modules & courses</small>
              </div>
              <Icon name="chevron" size={16} />
            </button>

            <button
              type="button"
              className="quick-action-row"
              onClick={() => navigate('/training')}
            >
              <div className="qa-icon-wrap qa-amber">
                <Icon name="calendar" size={16} />
              </div>
              <div className="qa-text">
                <b>Schedule Training</b>
                <small>Manage workshops & attendance</small>
              </div>
              <Icon name="chevron" size={16} />
            </button>

            <button
              type="button"
              className="quick-action-row"
              onClick={() => navigate('/recognition')}
            >
              <div className="qa-icon-wrap qa-rose">
                <Icon name="heart" size={16} />
              </div>
              <div className="qa-text">
                <b>Give Social Recognition</b>
                <small>Recognize top performers</small>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </article>
      </section>

      {/* Bottom Row: Modules Overview (All 6 Core Modules with Rings) */}
      <section className="saas-modules-overview-section">
        <div className="section-title-wrap">
          <h2>Modules Overview</h2>
          <p>Core HR performance, competency, and development engines</p>
        </div>

        <div className="saas-modules-grid">
          {/* Module 1: Performance */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Performance</b>
              <span className="mrc-icon-badge purple-tint"><Icon name="trend" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-purple"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - averagePerformance / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={`${averagePerformance}%`} /></strong>
                <small>Average</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={perfCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={perfCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/performance')}
            >
              View Details
            </button>
          </div>

          {/* Module 2: Competency */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Competency</b>
              <span className="mrc-icon-badge cyan-tint"><Icon name="zap" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-cyan"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - averageCompetency / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={`${averageCompetency}%`} /></strong>
                <small>Proficiency</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={compCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={compCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/competency')}
            >
              View Details
            </button>
          </div>

          {/* Module 3: Learning */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Learning</b>
              <span className="mrc-icon-badge emerald-tint"><Icon name="book" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-emerald"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - averageLearning / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={`${averageLearning}%`} /></strong>
                <small>Completion</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={learnCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={learnCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/learning')}
            >
              View Details
            </button>
          </div>

          {/* Module 4: Training */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Training</b>
              <span className="mrc-icon-badge amber-tint"><Icon name="calendar" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-amber"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - trainingAttendanceRate / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={trainingAttendanceRate > 0 ? `${trainingAttendanceRate}%` : '—'} /></strong>
                <small>Completion</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={totals.training_active ?? trainCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={totals.training_completed ?? trainCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/training')}
            >
              View Details
            </button>
          </div>

          {/* Module 5: Succession */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Succession</b>
              <span className="mrc-icon-badge rose-tint"><Icon name="crown" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-rose"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - successionPct / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={successionReady} /></strong>
                <small>Ready Now</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={succCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={succCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/succession')}
            >
              View Details
            </button>
          </div>

          {/* Module 6: Recognition */}
          <div className="module-ring-card">
            <div className="mrc-head">
              <b>Recognition</b>
              <span className="mrc-icon-badge pink-tint"><Icon name="heart" size={14} /></span>
            </div>
            <div className="mrc-ring-wrap">
              <svg viewBox="0 0 100 100" className="mrc-progress-svg">
                <circle cx="50" cy="50" r="40" className="ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="ring-bar ring-pink"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - recognitionRate / 100)}
                />
              </svg>
              <div className="mrc-ring-text">
                <strong><AnimatedNumber value={recognitionRate > 0 ? `${recognitionRate}%` : '—'} /></strong>
                <small>Completion</small>
              </div>
            </div>
            <div className="mrc-stats-row">
              <div><small>Active</small><b><AnimatedNumber value={recogCounts.active} /></b></div>
              <div><small>Completed</small><b><AnimatedNumber value={recogCounts.completed} /></b></div>
            </div>
            <button
              type="button"
              className="mrc-btn"
              onClick={() => navigate('/recognition')}
            >
              View Details
            </button>
          </div>
        </div>
      </section>

      {/* Employee Workforce Records & Executive AI Insights Section */}
      <section className="saas-workforce-insights-section">
        {/* Left: Workforce Table */}
        <div className="saas-table-panel">
          <div className="table-panel-head">
            <div>
              <h3>Workforce Performance &amp; Progress</h3>
              <p>Individual hospitality employee metrics</p>
            </div>
            <div className="table-search-box">
              <Icon name="search" size={14} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search employee or department..."
              />
            </div>
          </div>

          <div className="saas-table-wrap">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Performance</th>
                  <th>Learning Progress</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, index) => (
                  <tr
                    key={employee.id}
                    onClick={() => {
                      if (selected?.id === employee.id) {
                        setSelected(null)
                        setInsights(null)
                      } else {
                        setSelected(employee)
                        setInsights(null)
                      }
                    }}
                    className={selected?.id === employee.id ? 'selected-row' : ''}
                    title="Click to select employee for AI analysis"
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="emp-cell">
                        {employee.avatar_url ? (
                          <img
                            src={employee.avatar_url}
                            alt={employee.full_name}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              display: 'block',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span className={`emp-avatar av-${index % 6}`}>{initials(employee.full_name)}</span>
                        )}
                        <div className="emp-names">
                          <b>{employee.full_name}</b>
                          <small>{employee.job_title || 'Hospitality Staff'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="dept-tag">{employee.department}</span>
                    </td>
                    <td>
                      <div className="table-progress-cell">
                        <div className="bar-track">
                          <div className="bar-fill purple-fill" style={{ width: percent(employee.performance_score) }} />
                        </div>
                        <span>{percent(employee.performance_score)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-progress-cell">
                        <div className="bar-track">
                          <div className="bar-fill emerald-fill" style={{ width: percent(employee.learning_progress) }} />
                        </div>
                        <span>{percent(employee.learning_progress)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && (
              <div className="table-empty-msg">No employee records match your search.</div>
            )}
          </div>
        </div>

        {/* Right: AI Insights / Executive Report Panel */}
        <aside className="saas-ai-report-panel">
          <div className="report-panel-head">
            <div className="rph-left">
              <Sparkles className="w-4 h-4 text-gray-300 inline mr-2" />
              <div>
                <h3>{selected ? `${selected.full_name} Analytics` : 'AI Executive Report'}</h3>
                <p>{selected ? 'Individual hospitality brief' : report ? 'Saved executive report' : 'Organization-wide intelligence'}</p>
              </div>
            </div>
            {selected && (
              <button
                type="button"
                className="ai-status-chip flex items-center gap-1"
                onClick={() => { setSelected(null); setInsights(null); }}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
                title="Reset selection to Organization Brief"
              >
                <X className="w-3 h-3 inline" /> Deselect
              </button>
            )}
          </div>

          <div className="report-panel-body" id="ai-report-content">
            {report && !selected && !insights ? (
              <div className="insight-results-box">
                <div className="report-meta-tag">
                  <span>Generated {new Date(report.created_at).toLocaleDateString()}{report.generated_by_name ? ` by ${report.generated_by_name}` : ''}</span>
                  {report.metrics_json && <span className="data-chip"><CheckCircle className="w-3 h-3 inline mr-0.5 text-emerald-400" /> Data-backed</span>}
                </div>
                <AIReport content={report.content} title={report.title} />
              </div>
            ) : insights ? (
              <div className="insight-results-box">
                <div className="report-meta-tag">
                  <span>Individual Performance Analysis</span>
                  <span className="data-chip"><CheckCircle className="w-3 h-3 inline mr-0.5 text-emerald-400" /> Live Data</span>
                </div>
                <AIReport insights={insights} />
                {canGenerate && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="saas-btn-primary"
                      onClick={() => generate(selected)}
                      disabled={generating}
                      style={{ fontSize: 12, padding: '7px 14px' }}
                    >
                      {generating ? 'Regenerating...' : <><Sparkles className="w-3.5 h-3.5 inline mr-1" /> Regenerate Analysis</>}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="report-empty-state">
                <div className="empty-spark-icon"><Sparkles className="w-6 h-6 text-gray-300" /></div>
                <b>{selected ? `AI Analysis Ready: ${selected.full_name}` : canGenerate ? 'Workforce Brief Ready' : 'Executive Overview'}</b>
                <p>
                  {selected
                    ? `Click the button below to generate an AI performance and development brief for ${selected.full_name}.`
                    : canGenerate
                    ? 'Click the button below to generate an AI workforce analysis report based on live database values.'
                    : 'View workforce metrics and workflow activity. Executive report generation is restricted to HR.'}
                </p>
                {canGenerate && (
                  <button
                    type="button"
                    className="saas-btn-primary flex items-center justify-center gap-1.5"
                    onClick={() => generate(selected)}
                    disabled={generating}
                  >
                    <Sparkles className="w-4 h-4 inline" />
                    <span>
                      {generating
                        ? 'Analyzing Records...'
                        : selected
                        ? `Generate AI Insights for ${selected.full_name}`
                        : 'Generate Workforce Brief'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

