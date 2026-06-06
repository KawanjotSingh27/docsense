import { useState, useEffect } from 'react'
import axios from 'axios'
import Query from './Query'

interface Document {
  id: string
  filename: string
  status: string
  created_at: string
}

interface Props {
  token: string
  onLogout: () => void
}

export default function Dashboard({ token, onLogout }: Props) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [showQuery, setShowQuery] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())

  const headers = { Authorization: `Bearer ${token}` }

  const fetchDocuments = async () => {
    const res = await axios.get('/documents', { headers })
    const docs: Document[] = res.data

    setDocuments(docs)

    const completedIds = docs
      .filter(d => d.status === 'completed')
      .map(d => d.id)
    setSelectedDocs(new Set(completedIds))
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleUploadWithPolling = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('/documents/upload', formData, { headers })
      await fetchDocuments()

      const documentId = res.data.documentId
      const interval = setInterval(async () => {
        const statusRes = await axios.get(`/documents/${documentId}/status`, { headers })
        if (statusRes.data.status === 'completed' || statusRes.data.status === 'failed') {
          clearInterval(interval)
          await fetchDocuments()
        }
      }, 2000)
    } catch {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const completedDocs = documents.filter(d => d.status === 'completed')

  const statusColor = (status: string) => {
    if (status === 'completed') return 'green'
    if (status === 'failed') return 'red'
    return 'orange'
  }

  if (showQuery) {
    return (
      <Query
        token={token}
        documentIds={Array.from(selectedDocs)}
        onBack={() => setShowQuery(false)}
      />
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Your Documents</h2>
        <button onClick={onLogout} style={{ cursor: 'pointer' }}>Logout</button>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '20px 0', alignItems: 'center' }}>
        <label style={{
          padding: '10px 16px',
          background: '#0070f3',
          color: 'white',
          borderRadius: 6,
          cursor: 'pointer'
        }}>
          {uploading ? 'Uploading...' : 'Upload PDF'}
          <input
            type="file"
            accept="application/pdf"
            onChange={handleUploadWithPolling}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>

        {completedDocs.length > 0 && (
          <button
            onClick={() => setShowQuery(true)}
            disabled={selectedDocs.size === 0}
            style={{
              padding: '10px 16px',
              background: selectedDocs.size === 0 ? '#ccc' : '#111',
              color: 'white',
              borderRadius: 6,
              cursor: selectedDocs.size === 0 ? 'not-allowed' : 'pointer',
              border: 'none'
            }}
          >
            Ask a question {selectedDocs.size > 0 && `(${selectedDocs.size} doc${selectedDocs.size > 1 ? 's' : ''})`}
          </button>
        )}
      </div>

      {completedDocs.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          <span
            onClick={() => setSelectedDocs(new Set(completedDocs.map(d => d.id)))}
            style={{ cursor: 'pointer', marginRight: 12, textDecoration: 'underline' }}
          >
            Select all
          </span>
          <span
            onClick={() => setSelectedDocs(new Set())}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Deselect all
          </span>
        </div>
      )}

      {documents.length === 0 && (
        <p style={{ color: '#666' }}>No documents yet. Upload a PDF to get started.</p>
      )}

      {documents.map(doc => (
        <div key={doc.id} style={{
          border: '1px solid #eee',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {doc.status === 'completed' && (
              <input
                type="checkbox"
                checked={selectedDocs.has(doc.id)}
                onChange={() => toggleDoc(doc.id)}
              />
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>{doc.filename}</p>
              <p style={{ margin: 0, fontSize: 12, color: statusColor(doc.status) }}>
                {doc.status}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}