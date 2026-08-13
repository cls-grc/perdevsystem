/**
 * fixCertTemplateTitles.mjs
 * Re-links all auto-issued training certificates to the "Certificate of Participation" template.
 */
import pg from 'pg'
import { config as dotenvConfig } from 'dotenv'
dotenvConfig()

import { config } from './src/config.js'

const pool = new pg.Pool({ connectionString: config.databaseUrl })

async function fix() {
  const client = await pool.connect()
  try {
    // 1. Find or create the Certificate of Participation template
    let { rows: existing } = await client.query(
      `SELECT id FROM certificate_templates
       WHERE is_active = true
         AND (LOWER(name) LIKE '%participation%' OR LOWER(certificate_title) LIKE '%participation%')
       ORDER BY created_at ASC LIMIT 1`
    )

    let participationTemplateId = existing[0]?.id

    if (!participationTemplateId) {
      console.log('No "Certificate of Participation" template found — creating one...')
      const { rows: sysUser } = await client.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`)
      const createdBy = sysUser[0]?.id
      if (!createdBy) { console.error('No users found.'); process.exit(1) }

      const { rows: newTpl } = await client.query(
        `INSERT INTO certificate_templates(name, certificate_title, subtitle, organization_name, body_text, signatory_name, signatory_position, created_by)
         VALUES('Certificate of Participation', 'Certificate of Participation', 'Training Excellence Program',
                'Luxora Hotel and Restaurant',
                'Successfully completed professional development training as part of the Luxora Hotel and Restaurant learning program.',
                'HR Director', 'Human Resources', $1)
         RETURNING id`,
        [createdBy]
      )
      participationTemplateId = newTpl[0].id
      console.log('Created template:', participationTemplateId)
    } else {
      console.log('Found existing "Certificate of Participation" template:', participationTemplateId)
    }

    // 2. Find all training-auto-issued certs (those with metadata->sessionId) NOT on participation template
    const { rows: wrongCerts } = await client.query(
      `SELECT c.id, c.certificate_number, ct.certificate_title
       FROM certificates c
       JOIN certificate_templates ct ON ct.id = c.template_id
       WHERE c.metadata ? 'sessionId'
         AND c.template_id != $1`,
      [participationTemplateId]
    )

    console.log(`Found ${wrongCerts.length} training certificate(s) with wrong template.`)
    wrongCerts.forEach(r => console.log(` · ${r.certificate_number} — was "${r.certificate_title}"`))

    if (wrongCerts.length > 0) {
      const wrongIds = wrongCerts.map(r => r.id)
      const { rowCount } = await client.query(
        `UPDATE certificates SET template_id = $1 WHERE id = ANY($2::uuid[])`,
        [participationTemplateId, wrongIds]
      )
      console.log(`✅ Updated ${rowCount} certificate(s) to "Certificate of Participation".`)
    } else {
      console.log('✅ All training certificates already use the correct template.')
    }
  } finally {
    client.release()
    await pool.end()
  }
}

fix().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
