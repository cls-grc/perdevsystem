import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

// Hotels & Restaurant demo org for the Performance & Development subsystem.
// [number, name, department, title, performance, competency, learning, role, email]
const people = [
  // Executive / HR / Operations
  ['E004', 'Ava Reyes',        'Human Resources',   'HR Administrator',    90, 90, 88, 'hr',                'ava@pds.local'],
  ['E005', 'Noah Santos',      'Executive Office',  'Senior Manager',      91, 89, 86, 'management',        'noah@pds.local'],
  ['E006', 'Samir Patel',      'Operations',        'Operations Manager',  89, 86, 75, 'operations_manager','samir@pds.local'],
  // Department heads
  ['E002', 'Jordan Williams',  'Front Office',      'Front Office Manager',86, 88, 82, 'supervisor',        'jordan@pds.local'],
  ['E010', 'Anna Kowalski',    'Housekeeping',      'Housekeeping Manager',85, 84, 79, 'supervisor',        'anna@pds.local'],
  ['E013', 'Robert Johnson',   'Food & Beverage',   'Restaurant Manager',  84, 84, 71, 'supervisor',        'robert@pds.local'],
  ['E017', 'Marco Rossi',      'Kitchen',           'Executive Chef',      88, 87, 80, 'supervisor',        'marco@pds.local'],
  // Front Office
  ['E007', 'Maria Lopez',      'Front Office',      'Receptionist',        84, 82, 78, 'employee',          'maria@pds.local'],
  ['E008', 'David Kim',        'Front Office',      'Front Desk Staff',    80, 81, 74, 'employee',          'david@pds.local'],
  ['E009', 'Sofia Garcia',     'Front Office',      'Concierge',           83, 85, 77, 'employee',          'sofia@pds.local'],
  // Housekeeping
  ['E011', 'Rosa Martinez',    'Housekeeping',      'Housekeeping Staff',  82, 80, 73, 'employee',          'rosa@pds.local'],
  ['E012', 'Linda Chen',       'Housekeeping',      'Housekeeping Staff',  81, 79, 72, 'employee',          'linda@pds.local'],
  // Food & Beverage
  ['E001', 'Emily Thompson',   'Food & Beverage',   'Waitress',            84, 84, 71, 'employee',          'emily@pds.local'],
  ['E014', 'Chloe Brown',      'Food & Beverage',   'Waitress',            82, 81, 72, 'employee',          'chloe@pds.local'],
  ['E015', 'James Wilson',     'Food & Beverage',   'Bartender',           83, 80, 70, 'employee',          'james@pds.local'],
  ['E016', 'Grace Lee',        'Food & Beverage',   'Cashier',             80, 82, 69, 'employee',          'grace@pds.local'],
  // Kitchen
  ['E018', 'Andre Tan',        'Kitchen',           'Cook',                85, 83, 76, 'employee',          'andre@pds.local'],
  ['E019', 'Nina Petrova',     'Kitchen',           'Kitchen Staff',       80, 78, 70, 'employee',          'nina@pds.local'],
]

// Ensure departments exist (normalized table)
const deptNames = [...new Set(people.map(([, , dept]) => dept))]
for (const name of deptNames) {
  await pool.query('INSERT INTO departments(name) VALUES($1) ON CONFLICT(name) DO NOTHING', [name])
}

// manager map: department -> head employee_number
const deptManager = {
  'Front Office': 'E002',
  'Housekeeping': 'E010',
  'Food & Beverage': 'E013',
  'Kitchen': 'E017',
}

for (const [number, name, dept, title, perf, comp, learn, role, email] of people) {
  const managerNumber = deptManager[dept] && number !== deptManager[dept] ? deptManager[dept] : null
  const manager = managerNumber
    ? await pool.query('SELECT id FROM employees WHERE employee_number = $1', [managerNumber])
    : null
  const employee = await pool.query(
    `INSERT INTO employees(employee_number, full_name, department, department_id, job_title, manager_id, performance_score, competency_score, learning_progress)
     VALUES($1,$2,$3,(SELECT id FROM departments WHERE name=$3),$4,$5,$6,$7,$8)
     ON CONFLICT(employee_number) DO UPDATE SET
       full_name=EXCLUDED.full_name, department=EXCLUDED.department, department_id=EXCLUDED.department_id,
       job_title=EXCLUDED.job_title, manager_id=EXCLUDED.manager_id,
       performance_score=EXCLUDED.performance_score, competency_score=EXCLUDED.competency_score,
       learning_progress=EXCLUDED.learning_progress
     RETURNING id`,
    [number, name, dept, title, manager?.rows[0]?.id || null, perf, comp, learn]
  )
  await pool.query(
    'INSERT INTO users(employee_id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING',
    [employee.rows[0].id, email, passwordHash, name, role]
  )
}

console.log('Seeded hotel demo accounts. Password: ChangeMe123!')
await pool.end()
