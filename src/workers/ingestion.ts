import dotenv from 'dotenv'
dotenv.config()

import { Worker, Job } from 'bullmq'
import { pool } from '../db'
import { minioClient, BUCKET_NAME } from '../storage/index'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const OLLAMA_URL = 'http://localhost:11434'

async function extractText(buffer: Uint8Array): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }

  return pages.join('\n')
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []

  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    chunks.push(chunk)
    i += chunkSize - overlap
  }

  return chunks.filter(c => c.trim().length > 0)
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  })

  const data = await response.json() as { embedding: number[] }
  return data.embedding
}

async function processDocument(job: Job) {
  const { documentId, tenantId, storagePath } = job.data

  await pool.query(
    `UPDATE documents SET status = 'processing' WHERE id = $1`,
    [documentId]
  )

  const stream = await minioClient.getObject(BUCKET_NAME, storagePath)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  const fileBuffer = Buffer.concat(chunks)
  const text = await extractText(new Uint8Array(fileBuffer))

  if (!text.trim()) {
    await pool.query(
      `UPDATE documents SET status = 'failed' WHERE id = $1`,
      [documentId]
    )
    return
  }

  const textChunks = chunkText(text)

  for (const chunk of textChunks) {
    const embedding = await getEmbedding(chunk)

    await pool.query(
      `INSERT INTO chunks (document_id, tenant_id, content, embedding)
       VALUES ($1, $2, $3, $4)`,
      [documentId, tenantId, chunk, JSON.stringify(embedding)]
    )
  }

  await pool.query(
    `UPDATE documents SET status = 'completed' WHERE id = $1`,
    [documentId]
  )

  console.log(`Document ${documentId} processed — ${textChunks.length} chunks`)
}

const worker = new Worker('document-ingestion', processDocument, {
  connection: { host: 'localhost', port: 6379 }
})

worker.on('completed', job => console.log(`Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err))