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
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  const fetchDocuments = async () => {
    const res = await axios.get('/documents', { headers })
    setDocuments(res.data)
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const pollStatus = async (documentId: string) => {
    const interval = setInterval(async () => {
      const res = await axios.get(`/documents/${documentId}/status`, { headers })
      const status = res.data.status

      if (status === 'completed' || status === 'failed') {
        clearInterval(interval)
        await fetchDocuments()
      }
    }, 2000)
  }

  const handleUploadWithPolling = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post('/documents/upload', formData, { headers })
      await fetchDocuments()
      pollStatus(res.data.documentId)
    } catch {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const statusColor = (status: string) => {
    if (status === 'completed') return 'green'
    if (status === 'failed') return 'red'
    return 'orange'
  }

  if (selectedDoc) {
    return (
      <Query
        token={token}
        onBack={() => setSelectedDoc(null)}
      />
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Your Documents</h2>
        <button onClick={onLogout} style={{ cursor: 'pointer' }}>Logout</button>
      </div>

      <div style={{ margin: '20px 0' }}>
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
      </div>

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
          <div>
            <p style={{ margin: 0, fontWeight: 500 }}>{doc.filename}</p>
            <p style={{ margin: 0, fontSize: 12, color: statusColor(doc.status) }}>
              {doc.status}
            </p>
          </div>
          {doc.status === 'completed' && (
            <button
              onClick={() => setSelectedDoc(doc.id)}
              style={{ cursor: 'pointer', padding: '6px 12px' }}
            >
              Query
            </button>
          )}
        </div>
      ))}
    </div>
  )
}