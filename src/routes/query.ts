import { Router, Response } from 'express'
import { AuthRequest, authMiddleware } from '../middleware/auth'
import { pool } from '../db'

const router = Router()
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  })
  const data = await response.json() as { embedding: number[] }
  return data.embedding
}

function rrfScore(ranks: number[]): number {
  return ranks.reduce((sum, rank) => sum + 1 / (rank + 60), 0)
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { question, documentIds } = req.body
  const { tenantId } = req.user!

  if (!question) {
    res.status(400).json({ error: 'No question provided' })
    return
  }

  const hasFilter = Array.isArray(documentIds) && documentIds.length > 0

  const questionEmbedding = await getEmbedding(question)

  const vectorResults = await pool.query(
    `SELECT id, content
     FROM chunks
     WHERE tenant_id = $1
     ${hasFilter ? 'AND document_id = ANY($3)' : ''}
     ORDER BY embedding <=> $2
     LIMIT 10`,
    hasFilter
      ? [tenantId, JSON.stringify(questionEmbedding), documentIds]
      : [tenantId, JSON.stringify(questionEmbedding)]
  )

  const keywordResults = await pool.query(
    `SELECT id, content
     FROM chunks
     WHERE tenant_id = $1
     ${hasFilter ? 'AND document_id = ANY($3)' : ''}
     AND content_tsv @@ plainto_tsquery('english', $2)
     ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $2)) DESC
     LIMIT 10`,
    hasFilter
      ? [tenantId, question, documentIds]
      : [tenantId, question]
  )

  const scores = new Map<string, { content: string; score: number }>()

  vectorResults.rows.forEach((row, index) => {
    scores.set(row.id, {
      content: row.content,
      score: rrfScore([index + 1])
    })
  })

  keywordResults.rows.forEach((row, index) => {
    const existing = scores.get(row.id)
    if (existing) {
      existing.score += rrfScore([index + 1])
    } else {
      scores.set(row.id, {
        content: row.content,
        score: rrfScore([index + 1])
      })
    }
  })

  const topChunks = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(c => c.content)

  if (topChunks.length === 0) {
    res.status(404).json({ error: 'No documents found for this tenant' })
    return
  }

  const context = topChunks.join('\n\n---\n\n')

  const prompt = `You are a helpful assistant. Answer the user's question using ONLY the context provided below.
If the answer is not in the context, say "I couldn't find that in your documents."

Context:
${context}

Question: ${question}`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2:3b', prompt, stream: true, keep_alive: '10m' })
  })

  if (!ollamaResponse.body) {
    res.status(500).json({ error: 'No response from LLM' })
    return
  }

  const reader = ollamaResponse.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.response) {
          res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`)
        }
        if (parsed.done) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      } catch {
        //pass
      }
    }
  }
})

export default router