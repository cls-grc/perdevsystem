import { useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('ava@pds.local')
  const [password, setPassword] = useState('ChangeMe123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('')
    try { const result = await api.login(email, password); localStorage.setItem('pds-token', result.token); localStorage.setItem('pds-user', JSON.stringify(result.user)); onLogin(result.user) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="login-mark">▣</div><h1>Welcome to PerDevSys</h1><p>Sign in to manage workforce development and generate protected AI insights.</p>{error && <div className="login-error">{error}</div>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><small>Demo HR account: ava@pds.local</small></form></main>
}
