const BASE_URL = import.meta.env.VITE_API_URL || ''

let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('pds-refresh-token')
  if (!refreshToken) return null
  try {
    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Refresh failed')
    localStorage.setItem('pds-token', body.token)
    if (body.refreshToken) localStorage.setItem('pds-refresh-token', body.refreshToken)
    return body.token
  } catch {
    // Refresh failed — clear session
    localStorage.removeItem('pds-token')
    localStorage.removeItem('pds-refresh-token')
    return null
  }
}

async function request(path, options = {}, _retried = false) {
  // For login and register, never send an Authorization header — the endpoint is public.
  const isAuthEndpoint = path.startsWith('/api/auth/') && (path.includes('/login') || path.includes('/register'))
  const token = isAuthEndpoint ? null : localStorage.getItem('pds-token')
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  // If access token expired (401) and not already retried, try to refresh once.
  if (response.status === 401 && !_retried && !path.startsWith('/api/auth/')) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
    const newToken = await refreshPromise
    if (newToken) {
      return request(path, options, true)
    }
    throw new Error(body.error || 'Your session has expired. Please sign in again.')
  }
  if (!response.ok) throw new Error(body.error || 'Request failed. Please check that the backend is running on port 4000 and try again.')
  return body
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refreshToken: (refreshToken) => request('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken) => request('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  register: (token, password) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ token, password }) }),
  invite: (data) => request('/api/auth/invite', { method: 'POST', body: JSON.stringify(data) }),
workflows: (module, { page, limit, status } = {}) => {
    const qs = new URLSearchParams()
    if (module) qs.set('module', module)
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    if (status) qs.set('status', status)
    const queryStr = qs.toString()
    return request(`/api/workflows${queryStr ? `?${queryStr}` : ''}`)
  },
  workflow: (id) => request(`/api/workflows/${id}`),
  workflowDefinitions: () => request('/api/workflows/definitions'),
  workflowSubjects: () => request('/api/workflows/subjects'),
  createWorkflow: (data) => request('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
  advanceWorkflow: (id, data = {}) => request(`/api/workflows/${id}/advance`, { method: 'POST', body: JSON.stringify(data) }),
  returnWorkflow: (id, data = {}) => request(`/api/workflows/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
  cancelWorkflow: (id, reason) => request(`/api/workflows/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  addWorkflowNote: (id, data) => request(`/api/workflows/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  assignLearningGap: (data) => request('/api/workflows/assign-learning-gap', { method: 'POST', body: JSON.stringify(data) }),
  analytics: () => request('/api/analytics/dashboard'),
  analyticsMe: () => request('/api/analytics/me'),
  generateInsights: (employeeName) => request('/api/analytics/insights', { method: 'POST', body: JSON.stringify(employeeName ? { employeeName } : {}) }),
generateModuleInsights: (module, stage) => request('/api/analytics/module-insights', { method: 'POST', body: JSON.stringify({ module, stage }) }),
  executiveReport: () => request('/api/analytics/executive-report'),
  generateExecutiveReport: () => request('/api/analytics/executive-report', { method: 'POST', body: '{}' }),
workflowReports: (id) => request(`/api/workflows/${id}/ai-reports`),
  generateWorkflowReport: (id) => request(`/api/workflows/${id}/generate-report`, { method: 'POST', body: '{}' }),
  downloadReportPdf: async (id) => {
    const token = localStorage.getItem('pds-token')
    const response = await fetch(`${BASE_URL}/api/analytics/reports/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error || 'PDF download failed.')
    }
    return response.blob()
  },
notifications: ({ page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    const queryStr = qs.toString()
    return request(`/api/notifications${queryStr ? `?${queryStr}` : ''}`)
  },
  readNotifications: () => request('/api/notifications/read', { method: 'POST', body: '{}' }),
  emailOutbox: () => request('/api/notifications/outbox'),
  certificateTemplates: () => request('/api/certificates/templates'),
  createCertificateTemplate: (data) => request('/api/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateCertificateTemplate: (id, data) => request(`/api/certificates/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  retireCertificateTemplate: (id) => request(`/api/certificates/templates/${id}`, { method: 'DELETE' }),
  certificates: ({ page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    const queryStr = qs.toString()
    return request(`/api/certificates${queryStr ? `?${queryStr}` : ''}`)
  },
  issueCertificates: (data) => request('/api/certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
  revokeCertificate: (id, reason) => request(`/api/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
regenerateCertificate: (id) => request(`/api/certificates/${id}/regenerate`, { method: 'POST', body: '{}' }),
  // Public certificate verification — no auth required
  verifyCertificate: (verificationCode) => request(`/api/certificates/verify/${verificationCode}`),
  // Expiry automation
  checkExpiredCertificates: () => request('/api/certificates/check-expiry', { method: 'POST', body: '{}' }),
  // Employee management
  employees: () => request('/api/employees'),
  employeesAll: () => request('/api/employees/all'),
  employee: (id) => request(`/api/employees/${id}`),
  createEmployee: (data) => request('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/api/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateEmployee: (id) => request(`/api/employees/${id}/deactivate`, { method: 'POST', body: '{}' }),
  reactivateEmployee: (id) => request(`/api/employees/${id}/reactivate`, { method: 'POST', body: '{}' }),
  employeeHistory: (id) => request(`/api/employees/${id}/history`),
  departments: () => request('/api/employees/departments'),
// Audit log
  auditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/audit-logs${qs ? `?${qs}` : ''}`)
  },
// Learning Resource / Course Library
  learningResources: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.category) qs.set('category', params.category)
    if (params.providerType) qs.set('providerType', params.providerType)
    if (params.competency) qs.set('competency', params.competency)
    if (params.includeArchived) qs.set('includeArchived', 'true')
    const queryStr = qs.toString()
    return request(`/api/learning${queryStr ? `?${queryStr}` : ''}`)
  },
  createLearningResource: (data) => request('/api/learning', { method: 'POST', body: JSON.stringify(data) }),
  updateLearningResource: (id, data) => request(`/api/learning/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveLearningResource: (id) => request(`/api/learning/${id}`, { method: 'DELETE' }),
learningCompetencies: () => request('/api/learning/competencies'),
  learningSkillGaps: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.employeeId) qs.set('employeeId', params.employeeId)
    const queryStr = qs.toString()
    return request(`/api/learning/skill-gaps${queryStr ? `?${queryStr}` : ''}`)
  },
  assignLearning: (data) => request('/api/learning/assign', { method: 'POST', body: JSON.stringify(data) }),
  learningAssignments: () => request('/api/learning/assignments'),
  // Self-reported progress + status: employee drives their own study progress
  // (0-100) and a status flag (not_started / studying / completed / need_help).
updateLearningProgress: (id, progress) => request(`/api/learning/assignments/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
  updateLearningStatus: (id, status) => request(`/api/learning/assignments/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  recordLearningCompletion: (data) => request('/api/learning/completions', { method: 'POST', body: JSON.stringify(data) }),
  learningCompletions: () => request('/api/learning/completions'),
// Workflow due dates & overdue
  setWorkflowDueDate: (id, dueDate) => request(`/api/workflows/${id}/due-date`, { method: 'POST', body: JSON.stringify({ dueDate }) }),
  overdueWorkflows: (days = 3) => request(`/api/workflows/overdue?days=${days}`),
  // Database-grounded AI Chat Assistant
  chatAssistant: (data) => request('/api/chat', { method: 'POST', body: JSON.stringify(data) }),
  // CSV exports (client-side from fetched data — no extra endpoint needed)
  exportEmployeesCsv: async () => {
    const result = await request('/api/employees/all')
    return result.employees || []
  },
  exportAuditLogsCsv: async (params = {}) => {
    const qs = new URLSearchParams({ ...params, limit: 1000 }).toString()
    const result = await request(`/api/audit-logs${qs ? '?' + qs : ''}`)
    return result.logs || []
  },
}

