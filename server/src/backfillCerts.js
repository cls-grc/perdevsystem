import { query } from './db.js'

export async function runCertBackfill() {
  try {
    const completedSessions = await query(
      `SELECT ts.id, ts.title, ts.start_date, ts.created_by 
       FROM training_sessions ts 
       WHERE LOWER(ts.status) = 'completed'`
    )

    if (completedSessions.rows.length === 0) return

    let tplRes = await query(`SELECT id FROM certificate_templates WHERE is_active=true ORDER BY created_at ASC LIMIT 1`)
    let templateId = tplRes.rows[0]?.id
    const sysUser = await query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`)
    const sysUserId = sysUser.rows[0]?.id

    if (!templateId && sysUserId) {
      const newTpl = await query(
        `INSERT INTO certificate_templates(name, certificate_title, subtitle, organization_name, body_text, signatory_name, signatory_position, created_by)
         VALUES('Certificate of Participation', 'Certificate of Participation', 'Training Excellence Program', 'PerDevSys Hospitality', 'For active participation and completion of professional development training.', 'HR Director', 'Human Resources', $1)
         RETURNING id`,
        [sysUserId]
      )
      templateId = newTpl.rows[0].id
    }

    if (!templateId || !sysUserId) return

    for (const sess of completedSessions.rows) {
      const parts = await query(
        `SELECT tp.employee_id, e.full_name, e.department, e.employee_number, tp.attendance
         FROM training_participants tp 
         JOIN employees e ON tp.employee_id = e.id 
         WHERE tp.session_id = $1 AND LOWER(tp.attendance) IN ('present', 'late')`,
        [sess.id]
      )

      for (const emp of parts.rows) {
        const existing = await query(
          `SELECT id FROM certificates WHERE employee_id = $1 AND metadata->>'sessionId' = $2`,
          [emp.employee_id, String(sess.id)]
        )
        if (existing.rows.length === 0) {
          const certNum = `CERT-TRN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
          const achievement = `Successfully completed "${sess.title}" training session on ${String(sess.start_date || new Date().toISOString()).slice(0, 10)}.`
          const issuerId = sess.created_by || sysUserId

          await query(
            `INSERT INTO certificates(template_id, employee_id, certificate_number, achievement_text, awarded_at, issued_by, metadata)
             VALUES($1, $2, $3, $4, NOW()::date, $5, $6)`,
            [
              templateId,
              emp.employee_id,
              certNum,
              achievement,
              issuerId,
              JSON.stringify({
                sessionId: String(sess.id),
                sessionTitle: sess.title,
                employeeName: emp.full_name,
                department: emp.department,
              }),
            ]
          )

          await query(
            `INSERT INTO notifications(user_id, title, message)
             SELECT u.id, 'Certificate of Participation Issued', $1
             FROM users u WHERE u.employee_id = $2`,
            [`Congratulations! You have received an official Certificate of Participation for "${sess.title}".`, emp.employee_id]
          )
        }
      }
    }
  } catch (error) {
    console.error('runCertBackfill error:', error)
  }
}
