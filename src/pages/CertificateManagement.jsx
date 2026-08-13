import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { flushSync } from 'react-dom'
import useDialogFocus from '../hooks/useDialogFocus'
import { api } from '../lib/api'
import QRCodeImage from '../components/QRCodeImage'

const defaults = { name: 'Employee of the Month', certificateTitle: 'Certificate of Excellence', subtitle: 'Employee of the Month', organizationName: 'PerDevSys Hospitality', bodyText: 'This certificate is proudly awarded to {{employee_name}} in recognition of outstanding contribution and excellence.', signatoryName: 'Ava Reyes', signatoryPosition: 'HR Business Partner', validityDays: '' }
const date = value => value ? new Date(value).toLocaleDateString() : '—'

function Preview({ template, certificate, compact = false }) {
  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
  const name = certificate?.employee_name || '{{Employee Name}}'
  const text = (certificate?.achievement_text || template?.body_text || defaults.bodyText).replaceAll('{{employee_name}}', name)
  const verifyCode = certificate?.verification_code
  const verifyUrl = verifyCode ? `${publicAppUrl}/verify/certificate/${verifyCode}` : `${publicAppUrl}/verify/certificate/SAMPLE-VERIFICATION-CODE`

  return (
    <article className={`certificate-preview ${compact ? 'compact' : ''}`}>
      {template?.logo_url && <img className="certificate-logo" src={template.logo_url} alt="Organization logo"/>}
      <div className="certificate-seal">PDS</div>
      <small>{template?.organization_name || certificate?.organization_name || 'PerDevSys Hospitality'}</small>
      <h2>{template?.certificate_title || certificate?.certificate_title || 'Certificate of Excellence'}</h2>
      <em>{template?.subtitle || certificate?.subtitle || 'Recognition of achievement'}</em>
      <p>This certificate is presented to</p>
      <h1>{name}</h1>
      <div className="certificate-rule"/>
      <p className="certificate-body">{text}</p>
      <div className="certificate-foot">
        <span>Date awarded<br/><b>{date(certificate?.awarded_at)}</b></span>
        <span className="certificate-qr">
          <QRCodeImage value={verifyUrl} size={compact ? 70 : 90} />
          <small>VERIFY ONLINE</small>
        </span>
        <span>
          {template?.signature_url && <img className="certificate-signature" src={template.signature_url} alt="Authorized signature"/>}
          Authorized by<br/><b>{template?.signatory_name || certificate?.signatory_name || 'Authorized signatory'}</b>
        </span>
      </div>
      <footer>Certificate No. {certificate?.certificate_number || 'PDS-YYYY-00000000'}{verifyCode ? ` · Code: ${verifyCode}` : ''}</footer>
    </article>
  )
}

export default function CertificateManagement({ embedded = false }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role } catch { return '' } })(); const hr = role === 'hr'; const operationsManager = role === 'operations_manager'
  const Container = embedded ? 'section' : 'main'
  const CERTS_PER_PAGE = 8
  const [currentPage, setCurrentPage] = useState(1)
  const [templates, setTemplates] = useState([]), [certificates, setCertificates] = useState([]), [employees, setEmployees] = useState([]), [template, setTemplate] = useState(null), [recipientIds, setRecipientIds] = useState([]), [achievement, setAchievement] = useState('For exceptional performance and meaningful contribution to the organization.'), [form, setForm] = useState(defaults), [showForm, setShowForm] = useState(false), [editingTemplate, setEditingTemplate] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [query, setQuery] = useState(''), [employeeQuery, setEmployeeQuery] = useState(''), [sortBy, setSortBy] = useState('newest'), [printCert, setPrintCert] = useState(null)
  const load = async () => { try { const calls = [api.certificates()]; if (hr) calls.push(api.certificateTemplates(), api.workflowSubjects()); const result = await Promise.all(calls); setCertificates(result[0].certificates || []); if (hr) { setTemplates(result[1].templates || []); setEmployees(result[2].employees || []); if (!template && result[1].templates?.[0]) setTemplate(result[1].templates[0]) } } catch (requestError) { setError(requestError.message) } }
  useEffect(() => { load() }, [])
  const recipients = employees.filter(person => recipientIds.includes(person.id))
  const filtered = useMemo(() => {
    const matched = certificates.filter(c => `${c.employee_name} ${c.certificate_title} ${c.status} ${c.certificate_number || ''} ${c.verification_code || ''}`.toLowerCase().includes(query.toLowerCase()))
    switch (sortBy) {
      case 'oldest': return [...matched].sort((a, b) => new Date(a.issued_at || a.awarded_at || 0) - new Date(b.issued_at || b.awarded_at || 0))
      case 'name': return [...matched].sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''))
      case 'status': return [...matched].sort((a, b) => (a.status || '').localeCompare(b.status || ''))
      case 'newest':
      default: return [...matched].sort((a, b) => new Date(b.issued_at || b.awarded_at || 0) - new Date(a.issued_at || a.awarded_at || 0))
    }
  }, [certificates, query, sortBy])
  const totalPages = Math.max(1, Math.ceil(filtered.length / CERTS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safePage - 1) * CERTS_PER_PAGE, safePage * CERTS_PER_PAGE)
  const goToPage = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))
  // Reset to page 1 whenever the filter or sort changes
  useEffect(() => { setCurrentPage(1) }, [query, sortBy])
  const getPaginationPages = () => {
    const pages = []
    const delta = 2
    const left = Math.max(2, safePage - delta)
    const right = Math.min(totalPages - 1, safePage + delta)
    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }
  const modalRef = useDialogFocus(showForm, () => setShowForm(false))
  const upload = (field, file) => { if (!file) return; if (!file.type.startsWith('image/')) return setError('Please select an image file.'); if (file.size > 8 * 1024 * 1024) return setError('Image must be smaller than 8 MB.'); const reader = new FileReader(); reader.onload = () => setForm(current => ({ ...current, [field]: reader.result, [`${field}Name`]: file.name })); reader.readAsDataURL(file) }
  const save = async event => { event.preventDefault(); try { const data = { ...form, validityDays: form.validityDays ? Number(form.validityDays) : null }; const result = editingTemplate ? await api.updateCertificateTemplate(editingTemplate.id, data) : await api.createCertificateTemplate(data); setTemplates(items => editingTemplate ? items.map(item => item.id === result.template.id ? result.template : item) : [result.template, ...items]); setTemplate(result.template); setShowForm(false); setEditingTemplate(null); setNotice(editingTemplate ? 'Certificate template updated.' : 'Certificate template saved.') } catch (requestError) { setError(requestError.message) } }
  const editTemplate = (t) => { const target = t || template; if (!target) return setError('Select a template to edit.'); setForm({ name: target.name, certificateTitle: target.certificate_title, subtitle: target.subtitle || '', organizationName: target.organization_name, bodyText: target.body_text, signatoryName: target.signatory_name, signatoryPosition: target.signatory_position || '', validityDays: target.validity_days || '', logoUrl: target.logo_url || '', signatureUrl: target.signature_url || '' }); setEditingTemplate(target); setShowForm(true) }
  const retireTemplate = async (t) => { const target = t || template; if (!target || !window.confirm(`Retire ${target.name}? Issued certificates will remain available.`)) return; try { await api.retireCertificateTemplate(target.id); setTemplates(items => items.filter(item => item.id !== target.id)); if (template?.id === target.id) setTemplate(null); setNotice('Certificate template retired.'); } catch (requestError) { setError(requestError.message) } }
  const issue = async () => { if (!template || !recipientIds.length) return setError('Select a template and at least one employee.'); if (!window.confirm(`Generate ${recipientIds.length} certificate(s)?`)) return; try { await api.issueCertificates({ templateId: template.id, employeeIds: recipientIds, achievementText: achievement, awardedAt: new Date().toISOString().slice(0, 10) }); setNotice('Certificates generated and archived.'); await load() } catch (requestError) { setError(requestError.message) } }
  const revoke = async certificate => {
    const reason = window.prompt('Reason for revoking this certificate (min 3 characters):')
    if (!reason) return
    if (reason.trim().length < 3) return setError('Revoke reason must be at least 3 characters.')
    try { await api.revokeCertificate(certificate.id, reason.trim()); await load() } catch (requestError) { setError(requestError.message) }
  }
  const checkExpiry = async () => { try { const result = await api.checkExpiredCertificates(); if (result.expired > 0) { await load(); setNotice(`${result.expired} expired certificate(s) updated.`); } else { setNotice('No expired certificates found.'); } } catch (requestError) { setError(requestError.message) } }
  const archiveControls = <div className="certificate-archive-tools">{hr && <button className="certificate-expiry-btn" onClick={checkExpiry} title="Mark expired certificates">Expire outdated</button>}<label className="certificate-search-label"><input className="certificate-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search certificates or verification code…" aria-label="Search certificates"/>{query && <button className="certificate-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label><label className="certificate-sort-label">Sort<select className="certificate-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort certificates"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">By employee</option><option value="status">By status</option></select></label></div>
  const print = async certificate => {
    const fresh = await api.certificates()
    const current = fresh.certificates?.find(c => c.id === certificate.id) || certificate
    flushSync(() => setPrintCert(current))
    window.addEventListener('afterprint', () => setPrintCert(null), { once: true })
    setTimeout(() => window.print(), 30)
  }
  const downloadPdf = async certificate => {
    const fresh = await api.certificates()
    const current = fresh.certificates?.find(c => c.id === certificate.id) || certificate
    flushSync(() => setPrintCert(current))
    setTimeout(() => {
      window.print()
      window.addEventListener('afterprint', () => setPrintCert(null), { once: true })
    }, 30)
  }
  const copyVerificationLink = certificate => {
    const code = certificate.verification_code
    if (!code) return setError('Certificate verification code is missing.')
    const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const url = `${publicAppUrl}/verify/certificate/${code}`
    navigator.clipboard.writeText(url)
    setNotice(`✓ Copied verification link: ${url}`)
  }
  const verifyCertificate = async certificate => {
    const code = certificate.verification_code
    if (!code) return setError('This certificate has no verification code.')
    window.open(`/verify/certificate/${code}`, '_blank')
  }
  const paginationMarkup = totalPages > 1 ? (
    <div className="cert-pagination">
      <button className="cert-page-btn" onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} aria-label="Previous page">‹</button>
      {getPaginationPages().map((p, i) =>
        p === '...' ? <span key={`ellipsis-${i}`} className="cert-page-ellipsis">…</span>
          : <button key={p} className={`cert-page-btn ${p === safePage ? 'active' : ''}`} onClick={() => goToPage(p)}>{p}</button>
      )}
      <button className="cert-page-btn" onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} aria-label="Next page">›</button>
      <span className="cert-page-info">{(safePage - 1) * CERTS_PER_PAGE + 1}–{Math.min(safePage * CERTS_PER_PAGE, filtered.length)} of {filtered.length}</span>
    </div>
  ) : null
  const gallery = <div className="certificate-gallery-wrap"><div className="certificate-gallery">{paginated.map(c => <article className="certificate-card" key={c.id}><Preview certificate={c} compact/><div><span className={`certificate-status ${c.status}`}>{c.status}</span><h3>{hr ? c.employee_name : c.certificate_title}</h3><p>{c.certificate_number || date(c.awarded_at)}</p><p style={{fontSize:'8px', color:'#7254e5', margin:'2px 0 6px', fontFamily:'monospace'}}>Code: {c.verification_code || 'N/A'}</p><button onClick={() => print(c)}>Print</button><button className="certificate-download-btn" onClick={() => downloadPdf(c)}>Download PDF</button><button type="button" className="certificate-download-btn" onClick={() => copyVerificationLink(c)}>Copy Link</button>{hr && c.status === 'issued' && <><button onClick={() => api.regenerateCertificate(c.id).then(load)}>Regenerate</button><button className="certificate-revoke" onClick={() => revoke(c)}>Revoke</button></>}<button className="certificate-verify-btn" onClick={() => verifyCertificate(c)}>Verify Page</button></div></article>)}{!filtered.length && <div className="certificate-empty">No certificates {query ? 'match your search' : 'yet'}.</div>}</div>{paginationMarkup}</div>
  const employeeSearch = <div className="certificate-employee-search"><input className="certificate-search" value={employeeQuery} onChange={e => setEmployeeQuery(e.target.value)} placeholder="Search employee name, role, or department" aria-label="Search employees"/>{employeeQuery && <button className="certificate-clear" type="button" onClick={() => setEmployeeQuery('')} aria-label="Clear employee search">×</button>}</div>
  const printPortal = printCert && createPortal(<div className="certificate-print-root" role="dialog" aria-label="Print preview"><div className="certificate-print-sheet"><Preview template={printCert} certificate={printCert} /></div><button className="certificate-print-close" onClick={() => setPrintCert(null)}>× Close preview</button></div>, document.body)
  if (!hr) return <Container className={`certificate-workspace${embedded ? ' embedded' : ''}`}><header className="certificate-heading"><div><p className="eyebrow">{operationsManager ? 'Certificate monitoring' : 'My achievements'}</p><h1>{operationsManager ? 'Certificate management' : 'My Certificates'}</h1><span>{operationsManager ? 'Review issued employee certificates and recognition records across the operation.' : 'View, print, or save certificates earned through PerDevSys.'}</span></div></header><section className="certificate-archive"><div className="certificate-archive-inner"><h2>Issued certificates</h2>{archiveControls}</div>{gallery}</section>{printPortal}</Container>
  return <Container className={`certificate-workspace${embedded ? ' embedded' : ''}`}><header className="certificate-heading"><div><p className="eyebrow">Performance Management</p><h1>Certificate Management</h1><span>Create trusted recognition and achievement certificates from a guided issuance workflow.</span></div><button onClick={() => { setEditingTemplate(null); setForm(defaults); setShowForm(true) }}>+ Create template</button></header>{notice && <p className="certificate-notice">✓ {notice}</p>}{error && <p className="certificate-error">{error}</p>}<section className="certificate-issue"><div className="certificate-controls"><div className="certificate-section"><div className="section-label"><span>1</span><div><h2>Select a template</h2><p>Choose the certificate design and authorized signatory.</p></div></div><div className="template-grid">{templates.map(item => <div className={`template-card ${template?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setTemplate(item)}><Preview template={item} compact/><div className="template-card-footer"><b>{item.name}</b><div className="template-card-actions"><button type="button" className="tmpl-btn edit" title="Edit template" onClick={(e) => { e.stopPropagation(); setTemplate(item); editTemplate(item) }}>✏️ Edit</button><button type="button" className="tmpl-btn delete" title="Retire template" onClick={(e) => { e.stopPropagation(); retireTemplate(item) }}>🗑️ Retire</button></div></div></div>)}<button className="template-card create" onClick={() => { setEditingTemplate(null); setForm(defaults); setShowForm(true) }}>+ Create template</button></div></div><div className="certificate-section"><div className="section-label"><span>2</span><div><h2>Select qualified employees</h2><p>Search employees from all development modules.</p></div></div>{employeeSearch}{employees.filter(p => `${p.full_name} ${p.department} ${p.job_title}`.toLowerCase().includes(employeeQuery.toLowerCase())).map(p => <label className="recipient-row" key={p.id}><input type="checkbox" checked={recipientIds.includes(p.id)} onChange={() => setRecipientIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])}/><span>{p.full_name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span><div><b>{p.full_name}</b><small>{p.job_title} · {p.department}</small></div></label>)}</div><div className="certificate-section"><div className="section-label"><span>3</span><div><h2>Review details</h2><p>HR retains final control before issuance.</p></div></div><textarea value={achievement} onChange={e => setAchievement(e.target.value)}/><div className="review-recipients">{recipients.map(p => <span key={p.id}>{p.full_name}</span>)}</div><button className="certificate-primary" onClick={issue}>Generate certificates</button></div></div><aside className="certificate-preview-panel"><p>Live certificate preview</p><Preview template={template} certificate={recipients[0] ? { employee_name: recipients[0].full_name, achievement_text: achievement, awarded_at: new Date().toISOString().slice(0, 10) } : null}/></aside></section><section className="certificate-archive"><div className="certificate-archive-inner"><h2>Issued certificates</h2>{archiveControls}</div>{gallery}</section>{showForm && <div className="certificate-modal"><form onSubmit={save} ref={modalRef}><div className="modal-head"><div><h2>{editingTemplate ? 'Edit certificate template' : 'Create certificate template'}</h2><p>Customize the final printed certificate.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><div className="template-form">{[['name','Template name'],['certificateTitle','Certificate title'],['subtitle','Subtitle'],['organizationName','Organization name'],['signatoryName','Authorized signatory'],['signatoryPosition','Signatory position'],['validityDays','Validity in days (optional)']].map(([field,label]) => <label key={field}>{label}<input type={field === 'validityDays' ? 'number' : 'text'} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}/></label>)}<label className="full">Certificate body text<textarea value={form.bodyText} onChange={e => setForm({ ...form, bodyText: e.target.value })}/></label><label>Organization logo<input type="file" accept="image/*" onChange={e => upload('logoUrl', e.target.files?.[0])}/><small>{form.logoUrlName || 'PNG, JPG, SVG, or WEBP · max 8 MB'}</small></label><label>Authorized signature<input type="file" accept="image/*" onChange={e => upload('signatureUrl', e.target.files?.[0])}/><small>{form.signatureUrlName || 'PNG, JPG, SVG, or WEBP · max 8 MB'}</small></label></div><div className="modal-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="certificate-primary">Save template</button></div></form></div>}{printPortal}</Container>
}
