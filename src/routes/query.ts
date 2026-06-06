import { Router, Response } from 'express'
import { AuthRequest, authMiddleware } from '../middleware/auth'
import { pool } from '../db'

const router = Router()
const OLLAMA_URL = 'http://localhost:11434'

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  })
  const data = await response.json() as { embedding: number[] }
  return data.embedding
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('Query request:', req.body)
  const { question, documentIds } = req.body
  const { tenantId } = req.user!

  const hasFilter = Array.isArray(documentIds) && documentIds.length > 0

  if (!question) {
    res.status(400).json({ error: 'No question provided' })
    return
  }

  const questionEmbedding = await getEmbedding(question)

  const result = await pool.query(
    `SELECT content
    FROM chunks
    WHERE tenant_id = $1
    ${hasFilter ? 'AND document_id = ANY($3)' : ''}
    ORDER BY embedding <=> $2
    LIMIT 5`,
    hasFilter
      ? [tenantId, JSON.stringify(questionEmbedding), documentIds]
      : [tenantId, JSON.stringify(questionEmbedding)]
  )

  const chunks = result.rows.map(r => r.content)

  if (chunks.length === 0) {
    res.status(404).json({ error: 'No documents found for this tenant' })
    return
  }

  const context = chunks.join('\n\n---\n\n')

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
    body: JSON.stringify({
      model: 'llama3.2:3b',
      prompt,
      stream: true
    })
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
        
      }
    }
  }
})

export default router