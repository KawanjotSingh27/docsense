import { Router, Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { AuthRequest, authMiddleware } from '../middleware/auth'
import { pool } from '../db'
import { minioClient, BUCKET_NAME } from '../storage'
import { Queue } from 'bullmq'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const ingestionQueue = new Queue('document-ingestion', {
  connection: { host: 'localhost', port: 6379 }
})

router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const file = req.file
  const { tenantId, userId } = req.user!

  if (!file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  if (file.mimetype !== 'application/pdf') {
    res.status(400).json({ error: 'Only PDFs accepted' })
    return
  }

  try {
    const documentId = uuidv4()
    const storagePath = `${tenantId}/${documentId}/${file.originalname}`

    await minioClient.putObject(BUCKET_NAME, storagePath, file.buffer, file.size, {
      'Content-Type': 'application/pdf',
    })

    await pool.query(
      `INSERT INTO documents (id, tenant_id, filename, storage_path, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [documentId, tenantId, file.originalname, storagePath]
    )

    await ingestionQueue.add('process', {
      documentId,
      tenantId,
      storagePath
    })

    res.status(201).json({ documentId, status: 'pending' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!

  const result = await pool.query(
    `SELECT id, filename, status, created_at FROM documents WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  )

  res.json(result.rows)
})

export default router