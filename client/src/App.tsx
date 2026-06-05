import { useState} from 'react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'

function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token')
  })

  const handleLogin = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  if (!token) return <Auth onLogin={handleLogin} />
  return <Dashboard token={token} onLogout={handleLogout} />
}

export default App