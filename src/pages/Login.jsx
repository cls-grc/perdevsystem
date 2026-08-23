import { useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 2FA state
  const [is2FA, setIs2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api.login(email, password)
      if (result.require2FA) {
        setIs2FA(true)
        setTempToken(result.tempToken)
        setTwoFactorCode('')
        return
      }

      localStorage.setItem('pds-token', result.token)
      if (result.refreshToken) localStorage.setItem('pds-refresh-token', result.refreshToken)
      localStorage.setItem('pds-user', JSON.stringify(result.user))
      onLogin(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const submit2FA = async (event) => {
    event.preventDefault()
    if (!twoFactorCode || twoFactorCode.length < 6) {
      setError('Please enter your 6-digit Google Authenticator code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await api.verify2FA(tempToken, twoFactorCode)
      localStorage.setItem('pds-token', result.token)
      if (result.refreshToken) localStorage.setItem('pds-refresh-token', result.refreshToken)
      localStorage.setItem('pds-user', JSON.stringify(result.user))
      onLogin(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const cancel2FA = () => {
    setIs2FA(false)
    setTempToken('')
    setTwoFactorCode('')
    setError('')
  }

  return (
    <main className="login-page">
      {!is2FA ? (
        <form className="login-card" onSubmit={submit}>
          <div className="login-mark">▣</div>
          <h1>Welcome to PerDevSys</h1>
          <p>Sign in to manage workforce development and generate protected AI insights.</p>
          {notice && !error && (
            <div
              className="login-notice"
              style={{
                marginBottom: 14,
                borderRadius: 8,
                padding: '10px 12px',
                background: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⏰</span>
              <span>{notice}</span>
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      ) : (
        <form className="login-card" onSubmit={submit2FA}>
          <div className="login-mark" style={{ background: 'linear-gradient(135deg, #654bd2 0%, #3b2890 100%)' }}>
            🔒
          </div>
          <h1>Two-Factor Verification</h1>
          <p>
            Enter the 6-digit verification code from your <strong>Google Authenticator</strong> app for{' '}
            <span style={{ color: '#654bd2', fontWeight: 600 }}>{email}</span>.
          </p>
          {error && <div className="login-error">{error}</div>}
          <label>
            Authenticator Code
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\s+/g, '').slice(0, 10))}
              placeholder="000000"
              style={{
                fontSize: 20,
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: 4,
                fontFamily: 'monospace',
              }}
              required
            />
          </label>
          <button disabled={loading || twoFactorCode.length < 6} style={{ marginTop: 14 }}>
            {loading ? 'Verifying…' : 'Verify & Sign in'}
          </button>
          <button
            type="button"
            onClick={cancel2FA}
            disabled={loading}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: '1px solid #dcd9e4',
              color: '#654bd2',
              fontWeight: 600,
            }}
          >
            ← Back to Login
          </button>
        </form>
      )}
    </main>
  )
}
