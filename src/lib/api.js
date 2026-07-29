const BASE_URL = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const token = localStorage.getItem('pds-token')
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Unable to complete the request.')
  return body
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  workflows: (module) => request(`/api/workflows${module ? `?module=${module}` : ''}`),
  workflow: (id) => request(`/api/workflows/${id}`),
  workflowDefinitions: () => request('/api/workflows/definitions'),
  workflowSubjects: () => request('/api/workflows/subjects'),
  createWorkflow: (data) => request('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
  advanceWorkflow: (id, data = {}) => request(`/api/workflows/${id}/advance`, { method: 'POST', body: JSON.stringify(data) }),
  addWorkflowNote: (id, data) => request(`/api/workflows/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  analytics: () => request('/api/analytics/dashboard'),
  generateInsights: (employeeName) => request('/api/analytics/insights', { method: 'POST', body: JSON.stringify(employeeName ? { employeeName } : {}) }),
  generateModuleInsights: (module, stage) => request('/api/analytics/module-insights', { method: 'POST', body: JSON.stringify({ module, stage }) }),
  notifications: () => request('/api/notifications'),
  readNotifications: () => request('/api/notifications/read', { method: 'POST', body: '{}' }),
  certificateTemplates: () => request('/api/certificates/templates'),
  createCertificateTemplate: (data) => request('/api/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateCertificateTemplate: (id, data) => request(`/api/certificates/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  retireCertificateTemplate: (id) => request(`/api/certificates/templates/${id}`, { method: 'DELETE' }),
  certificates: () => request('/api/certificates'),
  issueCertificates: (data) => request('/api/certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
  revokeCertificate: (id, reason) => request(`/api/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  regenerateCertificate: (id) => request(`/api/certificates/${id}/regenerate`, { method: 'POST', body: '{}' }),
  certificateTemplates: () => request('/api/certificates/templates'),
  createCertificateTemplate: (data) => request('/api/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
  certificates: () => request('/api/certificates'),
  issueCertificates: (data) => request('/api/certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
  revokeCertificate: (id, reason) => request(`/api/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
}
