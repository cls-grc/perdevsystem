import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Mode: 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login')

  // 5-Second Show Password Auto-Hide State
  const [showPassword, setShowPassword] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef(null)

  // Reset Password State
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showResetPass, setShowResetPass] = useState(false)
  const [resetSecondsLeft, setResetSecondsLeft] = useState(0)
  const resetTimerRef = useRef(null)

  // Lockout State (3 Failed Attempts -> 1 Minute Lockout)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const lockoutTimerRef = useRef(null)

  // 2FA State
  const [is2FA, setIs2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (resetTimerRef.current) clearInterval(resetTimerRef.current)
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      lockoutTimerRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(lockoutTimerRef.current)
            setError('')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [lockoutSeconds > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5-second password peek handler for Login
  const handleToggleShowPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (timerRef.current) clearInterval(timerRef.current)

    setShowPassword(true)
    setSecondsLeft(5)

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setShowPassword(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // 5-second password peek handler for Reset Password
  const handleToggleShowResetPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (resetTimerRef.current) clearInterval(resetTimerRef.current)

    setShowResetPass(true)
    setResetSecondsLeft(5)

    resetTimerRef.current = setInterval(() => {
      setResetSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(resetTimerRef.current)
          setShowResetPass(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (lockoutSeconds > 0) return

    setLoading(true)
    setError('')
    setSuccessMsg('')
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
      const errMsg = requestError.message || ''
      setError(errMsg)

      // Check if locked out (429 or 1-minute lockout triggered)
      if (errMsg.toLowerCase().includes('locked') || errMsg.toLowerCase().includes('seconds')) {
        const match = errMsg.match(/(\d+)\s*second/i)
        const secs = match ? parseInt(match[1], 10) : 60
        setLockoutSeconds(secs)
      }
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

  // Handle Forgot Password submission
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your registered email address.')
      return
    }
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await api.forgotPassword(email)
      setSuccessMsg(res.message || 'Password reset link has been prepared.')
      if (res.resetToken) {
        setResetToken(res.resetToken)
      }
      setMode('reset')
    } catch (err) {
      setError(err.message || 'Unable to process password reset.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Reset Password submission
  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetToken.trim()) {
      setError('Please provide a valid password reset token.')
      return
    }
    if (!newPassword) {
      setError('Please enter a new password.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      await api.resetPassword(resetToken.trim(), newPassword)
      setSuccessMsg('Your password has been successfully reset! You can now sign in with your new password.')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setResetToken('')
      setMode('login')
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  // Render 2FA View
  if (is2FA) {
    return (
      <main className="login-page">
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
      </main>
    )
  }

  // Render Forgot Password View
  if (mode === 'forgot') {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleForgotPassword}>
          <div className="login-mark" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}>
            🔑
          </div>
          <h1>Forgot Password</h1>
          <p>Enter your registered work email to receive password reset instructions.</p>
          {error && <div className="login-error">{error}</div>}
          {successMsg && (
            <div className="login-notice" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hotel.com"
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          <button disabled={loading} style={{ marginTop: 14 }}>
            {loading ? 'Sending Instructions…' : 'Reset Password'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
            disabled={loading}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: '1px solid #dcd9e4',
              color: '#654bd2',
              fontWeight: 600,
            }}
          >
            ← Back to Sign In
          </button>
        </form>
      </main>
    )
  }

  // Render Reset Password View
  if (mode === 'reset') {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleResetPassword}>
          <div className="login-mark" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            🛡️
          </div>
          <h1>Set New Password</h1>
          <p>Create a strong password for your account.</p>
          {error && <div className="login-error">{error}</div>}
          {successMsg && (
            <div className="login-notice" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
              <span>ℹ</span>
              <span>{successMsg}</span>
            </div>
          )}

          <label>
            Reset Verification Token
            <input
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste reset token"
              required
            />
          </label>

          <label style={{ marginBottom: 0 }}>
            New Password
            <div className="login-password-field">
              <input
                type={showResetPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters (1 upper, 1 lower, 1 number, 1 special)"
                required
              />
              <button
                type="button"
                className={`password-toggle${showResetPass ? ' active' : ''}`}
                onClick={handleToggleShowResetPassword}
                title={showResetPass ? `Visible for ${resetSecondsLeft}s` : 'Show password for 5 seconds'}
                tabIndex={0}
              >
                <span className="password-toggle-icon">{showResetPass ? '👁' : '👁‍🗨'}</span>
                <span className="password-toggle-label">{showResetPass ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </label>

          <label>
            Confirm New Password
            <input
              type={showResetPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
            />
          </label>

          <button disabled={loading} style={{ marginTop: 14 }}>
            {loading ? 'Updating Password…' : 'Confirm New Password'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
            disabled={loading}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: '1px solid #dcd9e4',
              color: '#654bd2',
              fontWeight: 600,
            }}
          >
            ← Cancel &amp; Back to Login
          </button>
        </form>
      </main>
    )
  }

  // Standard Login View
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">▣</div>
        <h1>Welcome to PerDevSys</h1>
        <p>Sign in to manage workforce development and generate protected AI insights.</p>

        {notice && !error && !successMsg && (
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

        {successMsg && (
          <div
            className="login-notice"
            style={{
              marginBottom: 14,
              borderRadius: 8,
              padding: '10px 12px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {lockoutSeconds > 0 && (
          <div
            className="login-lockout-banner"
            style={{
              marginBottom: 14,
              borderRadius: 8,
              padding: '10px 14px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>🔒</span>
            <div>
              <div>Account temporarily locked (3 failed attempts).</div>
              <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                Please wait <strong style={{ textDecoration: 'underline' }}>{lockoutSeconds} second{lockoutSeconds === 1 ? '' : 's'}</strong> before trying again.
              </div>
            </div>
          </div>
        )}

        {error && lockoutSeconds === 0 && <div className="login-error">{error}</div>}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address"
            autoComplete="email"
            required
            disabled={loading}
          />
        </label>

        <label style={{ marginBottom: 0 }}>
          Password
          <div className="login-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
            <button
              type="button"
              className={`password-toggle${showPassword ? ' active' : ''}`}
              onClick={handleToggleShowPassword}
              title={showPassword ? `Visible for ${secondsLeft}s (auto-hides)` : 'Show password for 5 seconds'}
              tabIndex={0}
            >
              <span className="password-toggle-icon">{showPassword ? '👁' : '👁‍🗨'}</span>
              <span className="password-toggle-label">{showPassword ? 'Hide' : 'Show'}</span>
            </button>
          </div>
        </label>

        {/* Forgot password — plain text link, left-aligned, below password field */}
        <div className="login-forgot-row">
          <button
            type="button"
            className="forgot-link"
            onClick={() => { setMode('forgot'); setError(''); setSuccessMsg('') }}
          >
            Forgot password?
          </button>
        </div>

        <button disabled={loading || lockoutSeconds > 0}>
          {loading ? 'Signing in…' : lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

