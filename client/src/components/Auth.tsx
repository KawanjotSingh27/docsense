import { useState } from 'react'
import axios from 'axios'

interface Props {
  onLogin: (token: string) => void
}

export default function Auth({ onLogin }: Props) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
        const endpoint = isRegister ? '/auth/register' : '/auth/login'
        const payload = isRegister
        ? { email, password, tenantName }
        : { email, password }

        const res = await axios.post(endpoint, payload)
        onLogin(res.data.token)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        setError(err.response?.data?.error || 'Something went wrong')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 8, fontSize: 14 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 8, fontSize: 14 }}
        />
        {isRegister && (
          <input
            placeholder="Organisation name"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            style={{ padding: 8, fontSize: 14 }}
          />
        )}

        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ padding: 10, fontSize: 14, cursor: 'pointer' }}
        >
          {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
        </button>

        <button
          onClick={() => { setIsRegister(!isRegister); setError('') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'blue' }}
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  )
}