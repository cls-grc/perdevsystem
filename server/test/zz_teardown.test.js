import { after } from 'node:test'
import { pool } from '../src/db.js'

// Teardown: close the shared pg pool so node --test can exit cleanly.
// This file is named zz_... so it runs alphabetically LAST after all other
// test files have finished, ensuring no test is left mid-flight when we close.
after(async () => {
  await pool.end()
})
