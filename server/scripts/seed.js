import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'
const passwordHash = await bcrypt.hash('ChangeMe123!', 12)
const people = [
  ['E001','Emily Thompson','Food & Beverage','Restaurant Manager',84,84,71,'employee','emily@pds.local'],
  ['E002','Jordan Williams','Front Office','Front Office Supervisor',86,88,82,'supervisor','jordan@pds.local'],
  ['E003','Maya Chen','Product','Head of Design',88,85,78,'employee','maya@pds.local'],
  ['E004','Ava Reyes','People Operations','HR Business Partner',90,90,88,'hr','ava@pds.local'],
  ['E005','Noah Santos','Executive Office','Senior Operations Manager',91,89,86,'management','noah@pds.local'],
  ['E006','Samir Patel','Operations','Operations Manager',89,86,75,'operations_manager','samir@pds.local'],
]
for (const [number,name,department,title,performance,competency,learning,role,email] of people) {
  const employee = await pool.query('INSERT INTO employees(employee_number,full_name,department,job_title,performance_score,competency_score,learning_progress) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(employee_number) DO UPDATE SET full_name=EXCLUDED.full_name RETURNING id', [number,name,department,title,performance,competency,learning])
  await pool.query('INSERT INTO users(employee_id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING', [employee.rows[0].id,email,passwordHash,name,role])
}
console.log('Seeded demo accounts. Password: ChangeMe123!')
await pool.end()
