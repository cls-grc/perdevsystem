import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db.js'
import { authenticate, authorize } from '../middleware.js'

const router = Router()

// Public certificate verification endpoint — must be registered BEFORE the auth
// middleware so third parties can validate certificate authenticity without a token.
router.get('/verify/:code', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT c.certificate_number, c.achievement_text, c.awarded_at, c.expires_at, c.status,
      e.full_name AS employee_name, t.certificate_title, t.organization_name, t.signatory_name, t.signatory_position
      FROM certificates c JOIN employees e ON e.id=c.employee_id JOIN certificate_templates t ON t.id=c.template_id
      WHERE c.verification_code=$1`, [req.params.code])
    if (!rows[0]) return res.status(404).json({ error: 'Certificate not found. The verification code may be invalid.' })
    const cert = rows[0]
    res.json({
      verified: true,
      certificateNumber: cert.certificate_number,
      employeeName: cert.employee_name,
      title: cert.certificate_title,
      organization: cert.organization_name,
      achievement: cert.achievement_text,
      awardedAt: cert.awarded_at,
      expiresAt: cert.expires_at,
      status: cert.status,
      signatory: cert.signatory_name,
      signatoryPosition: cert.signatory_position,
    })
  } catch (error) { next(error) }
})

router.use(authenticate)
const imageValue = z.string().max(11500000).optional().or(z.literal('')).default('')
const templateSchema = z.object({ name: z.string().min(3).max(120), certificateTitle: z.string().min(3).max(160), subtitle: z.string().max(180).optional().default(''), organizationName: z.string().min(2).max(160), bodyText: z.string().min(10).max(2000), logoUrl: imageValue, signatoryName: z.string().min(2).max(120), signatoryPosition: z.string().max(120).optional().default(''), signatureUrl: imageValue, backgroundUrl: imageValue, validityDays: z.coerce.number().int().positive().nullable().optional() })
const issueSchema = z.object({ templateId: z.string().uuid(), employeeIds: z.array(z.string().uuid()).min(1).max(100), achievementText: z.string().min(5).max(1000), awardedAt: z.string().date().optional() })
const revokeSchema = z.object({ reason: z.string().min(3).max(500) })

router.get('/templates', authorize('hr'), async (_req, res, next) => { try { const { rows } = await query('SELECT * FROM certificate_templates ORDER BY created_at DESC'); res.json({ templates: rows }) } catch (error) { next(error) } })
router.post('/templates', authorize('hr'), async (req, res, next) => { try { const input = templateSchema.parse(req.body); const { rows } = await query('INSERT INTO certificate_templates(name,certificate_title,subtitle,organization_name,body_text,logo_url,signatory_name,signatory_position,signature_url,background_url,validity_days,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [input.name, input.certificateTitle, input.subtitle, input.organizationName, input.bodyText, input.logoUrl || null, input.signatoryName, input.signatoryPosition || null, input.signatureUrl || null, input.backgroundUrl || null, input.validityDays || null, req.user.sub]); res.status(201).json({ template: rows[0] }) } catch (error) { next(error) } })
router.patch('/templates/:id', authorize('hr'), async (req, res, next) => { try { const input = templateSchema.parse(req.body); const { rows } = await query('UPDATE certificate_templates SET name=$1,certificate_title=$2,subtitle=$3,organization_name=$4,body_text=$5,logo_url=$6,signatory_name=$7,signatory_position=$8,signature_url=$9,background_url=$10,validity_days=$11,updated_at=NOW() WHERE id=$12 AND is_active=true RETURNING *', [input.name, input.certificateTitle, input.subtitle, input.organizationName, input.bodyText, input.logoUrl || null, input.signatoryName, input.signatoryPosition || null, input.signatureUrl || null, input.backgroundUrl || null, input.validityDays || null, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Active certificate template not found.' }); res.json({ template: rows[0] }) } catch (error) { next(error) } })
router.delete('/templates/:id', authorize('hr'), async (req, res, next) => { try { const { rows } = await query('UPDATE certificate_templates SET is_active=false,updated_at=NOW() WHERE id=$1 AND is_active=true RETURNING *', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Active certificate template not found.' }); res.json({ retired: true }) } catch (error) { next(error) } })
router.get('/', authorize('hr', 'employee'), async (req, res, next) => { try {
    // Auto-expire any certificates past their expiry date before returning the list.
    await query("UPDATE certificates SET status='expired', metadata=metadata || jsonb_build_object('expiredAt', NOW()::text) WHERE status='issued' AND expires_at IS NOT NULL AND expires_at < NOW()::date")
    const params = []; let where = 'WHERE 1=1'; if (req.user.role === 'employee') { params.push(req.user.employeeId); where += ` AND c.employee_id=$${params.length}` } const { page = '1', limit = '50' } = req.query; const pageNum = Math.max(1, parseInt(page, 10) || 1); const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50)); const offset = (pageNum - 1) * limitNum; const countResult = await query(`SELECT count(*)::int AS total FROM certificates c ${where}`, params); const total = countResult.rows[0]?.total || 0; params.push(limitNum, offset); const { rows } = await query(`SELECT c.*, e.full_name AS employee_name, e.department, t.name AS template_name, t.certificate_title, t.subtitle, t.organization_name, t.body_text, t.logo_url, t.signature_url, t.signatory_name, t.signatory_position FROM certificates c JOIN employees e ON e.id=c.employee_id JOIN certificate_templates t ON t.id=c.template_id ${where} ORDER BY c.issued_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params); res.json({ certificates: rows, total, page: pageNum, limit: limitNum }) } catch (error) { next(error) } })
router.post('/issue', authorize('hr'), async (req, res, next) => { try { const input = issueSchema.parse(req.body); const result = await transaction(async client => { const templateResult = await client.query('SELECT * FROM certificate_templates WHERE id=$1 AND is_active=true', [input.templateId]); const template = templateResult.rows[0]; if (!template) throw Object.assign(new Error('Certificate template is not available.'), { status: 404 }); const people = await client.query('SELECT id, full_name, department, employee_number FROM employees WHERE id = ANY($1::uuid[]) AND is_active=true', [input.employeeIds]); if (people.rowCount !== input.employeeIds.length) throw Object.assign(new Error('One or more selected employees are unavailable.'), { status: 400 }); const created = []; for (const employee of people.rows) { const certificateNumber = `PDS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; const expiresAt = template.validity_days ? new Date(Date.parse(input.awardedAt || new Date().toISOString().slice(0, 10)) + template.validity_days * 86400000).toISOString().slice(0, 10) : null; const inserted = await client.query('INSERT INTO certificates(template_id,employee_id,certificate_number,achievement_text,awarded_at,expires_at,issued_by,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [template.id, employee.id, certificateNumber, input.achievementText, input.awardedAt || new Date().toISOString().slice(0, 10), expiresAt, req.user.sub, { employeeName: employee.full_name, employeeNumber: employee.employee_number, department: employee.department }]); created.push(inserted.rows[0]) } return created }); res.status(201).json({ certificates: result }) } catch (error) { next(error) } })
router.post('/:id/revoke', authorize('hr'), async (req, res, next) => { try { const input = revokeSchema.parse(req.body); const { rows } = await query("UPDATE certificates SET status='revoked', revoked_at=NOW(), revoked_reason=$1 WHERE id=$2 AND status='issued' RETURNING *", [input.reason, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Issued certificate not found.' }); res.json({ certificate: rows[0] }) } catch (error) { next(error) } })
router.post('/:id/regenerate', authorize('hr'), async (req, res, next) => { try { const { rows } = await query("UPDATE certificates SET metadata=metadata || jsonb_build_object('regeneratedAt', NOW()::text) WHERE id=$1 AND status='issued' RETURNING *", [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Issued certificate not found.' }); res.json({ certificate: rows[0] }) } catch (error) { next(error) } })
// Expiry automation — HR can manually trigger the expiry check. The GET / route also auto-runs this.
router.post('/check-expiry', authorize('hr'), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE certificates SET status='expired', metadata=metadata || jsonb_build_object('expiredAt', NOW()::text) WHERE status='issued' AND expires_at IS NOT NULL AND expires_at < NOW()::date RETURNING id")
    res.json({ expired: rows.length, certificates: rows })
  } catch (error) { next(error) }
})
export default router
