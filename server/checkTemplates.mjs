import pg from 'pg'
import { config } from './src/config.js'
const pool = new pg.Pool({ connectionString: config.databaseUrl })
const { rows } = await pool.query(`
  SELECT ct.id, ct.name, ct.certificate_title, ct.is_active,
    (SELECT COUNT(*) FROM certificates c WHERE c.template_id = ct.id)::int AS cert_count
  FROM certificate_templates ct
  ORDER BY ct.created_at
`)
console.table(rows)
await pool.end()
