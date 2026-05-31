import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../db'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, tenantName } = req.body

  if (!email || !password || !tenantName) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  try {
    const tenantResult = await pool.query(
      `INSERT INTO tenants (name) VALUES ($1) RETURNING id`,
      [tenantName]
    )
    const tenantId = tenantResult.rows[0].id

    const passwordHash = await bcrypt.hash(password, 10)
    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [tenantId, email, passwordHash]
    )
    const userId = userResult.rows[0].id

    const token = jwt.sign(
      { userId, tenantId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.status(201).json({ token, tenantId })
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' })
      return
    }
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  try {
    const result = await pool.query(
      `SELECT id, tenant_id, password_hash FROM users WHERE email = $1`,
      [email]
    )

    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.json({ token, tenantId: user.tenant_id })
  } catch {
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router