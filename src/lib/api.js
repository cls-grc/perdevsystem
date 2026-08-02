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
  workflows: (module, { page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (module) qs.set('module', module)
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
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
  analytics: () => request('/api/analytics/dashboard'),
  analyticsMe: () => request('/api/analytics/me'),
  generateInsights: (employeeName) => request('/api/analytics/insights', { method: 'POST', body: JSON.stringify(employeeName ? { employeeName } : {}) }),
  generateModuleInsights: (module, stage) => request('/api/analytics/module-insights', { method: 'POST', body: JSON.stringify({ module, stage }) }),
notifications: ({ page, limit } = {}) => {
    const qs = new URLSearchParams()
    if (page) qs.set('page', page)
    if (limit) qs.set('limit', limit)
    const queryStr = qs.toString()
    return request(`/api/notifications${queryStr ? `?${queryStr}` : ''}`)
  },
  readNotifications: () => request('/api/notifications/read', { method: 'POST', body: '{}' }),
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
  // Workflow due dates & overdue
  setWorkflowDueDate: (id, dueDate) => request(`/api/workflows/${id}/due-date`, { method: 'POST', body: JSON.stringify({ dueDate }) }),
  overdueWorkflows: (days = 3) => request(`/api/workflows/overdue?days=${days}`),
  // Goals / OKRs
  goals: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/goals${qs ? `?${qs}` : ''}`)
  },
  goal: (id) => request(`/api/goals/${id}`),
  createGoal: (data) => request('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id, data) => request(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteGoal: (id, reason = 'Cancelled') => request(`/api/goals/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  restoreGoal: (id) => request(`/api/goals/${id}/restore`, { method: 'POST', body: '{}' }),
  verifyGoal: (id, comment = '') => request(`/api/goals/${id}/verify`, { method: 'POST', body: JSON.stringify({ comment }) }),
  rejectGoal: (id, reason) => request(`/api/goals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  goalHistory: (id) => request(`/api/goals/${id}/history`),
  // 360° feedback
  feedbackRequests: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/feedback${qs ? `?${qs}` : ''}`)
  },
  pendingFeedback: () => request('/api/feedback/pending'),
  createFeedbackRequest: (data) => request('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),
  submitFeedback: (id, data) => request(`/api/feedback/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  closeFeedback: (id) => request(`/api/feedback/${id}/close`, { method: 'POST', body: '{}' }),
}
