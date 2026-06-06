import { useState } from 'react'

interface Props {
  token: string
  documentIds: string[]
  onBack: () => void
}

export default function Query({ token, documentIds, onBack }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleQuery = async () => {
    if (!question.trim()) return
    setAnswer('')
    setLoading(true)

    try {
      const response = await fetch('/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, documentIds })
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.token) setAnswer(prev => prev + parsed.token)
          } catch {
            //pass
          }
        }
      }
    } catch {
      setAnswer('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <button onClick={onBack} style={{ marginBottom: 20, cursor: 'pointer' }}>
        Back to documents
      </button>

      <h2>Ask a question</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything about your documents..."
          style={{ flex: 1, padding: 8, fontSize: 14 }}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
        />
        <button
          onClick={handleQuery}
          disabled={loading}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {answer && (
        <div style={{
          background: '#f9f9f9',
          border: '1px solid #eee',
          borderRadius: 8,
          padding: 16,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap'
        }}>
          {answer}
        </div>
      )}
    </div>
  )
}