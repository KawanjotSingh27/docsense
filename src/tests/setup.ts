import { pool } from '../db'
import { initDB } from '../db/schema'
import { ingestionQueue } from '../routes/documents'

beforeAll(async () => {
  await initDB()
})

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE chunks, documents, users, tenants CASCADE`)
  await pool.end()
  await ingestionQueue.close()
})