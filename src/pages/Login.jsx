import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import LoginIllustration from '../components/LoginIllustration'
import { Key, Eye, EyeOff, Tag, AlertTriangle, CheckCircle, Clock, Lock, Info, Building2, Mail, Check } from 'lucide-react'

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Session notice from sessionStorage
  const [sessionNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('pds-session-notice') || ''
      if (msg) sessionStorage.removeItem('pds-session-notice')
      return msg
    } catch {
      return ''
    }
  })

  const displayNotice = sessionNotice || notice || ''

  // Dark / Light Theme state
  const [isDark, setIsDark] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('pds-theme') === 'dark'
    } catch {
      return false
    }
  })

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    const root = document.documentElement
    if (nextDark) {
      root.classList.add('dark')
      try { localStorage.setItem('pds-theme', 'dark') } catch (err) { void err }
    } else {
      root.classList.remove('dark')
      try { localStorage.setItem('pds-theme', 'light') } catch (err) { void err }
    }
  }

  // Mode: 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login')

  // 5-Second Password Peek State
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

  // Lockout State
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const lockoutTimerRef = useRef(null)

  // 2FA State
  const [is2FA, setIs2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')

  // Login Success State (Triggers Cinematic Entrance Transition)
  const [isLoggingInSuccess, setIsLoggingInSuccess] = useState(false)

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

    if (showPassword) {
      if (timerRef.current) clearInterval(timerRef.current)
      setShowPassword(false)
      setSecondsLeft(0)
      return
    }

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

  // 5-second password peek handler for Reset
  const handleToggleShowResetPassword = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (showResetPass) {
      if (resetTimerRef.current) clearInterval(resetTimerRef.current)
      setShowResetPass(false)
      setResetSecondsLeft(0)
      return
    }

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
    if (lockoutSeconds > 0 || isLoggingInSuccess) return

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

      // Instantly transition to dashboard
      onLogin(result.user)
    } catch (requestError) {
      const errMsg = requestError.message || ''
      setError(errMsg)

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
    if (!twoFactorCode || twoFactorCode.length < 6 || isLoggingInSuccess) {
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your registered enterprise email address.')
      return
    }
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await api.forgotPassword(email)
      setSuccessMsg(res.message || 'Password reset link has been prepared.')
      if (res.resetToken) setResetToken(res.resetToken)
      setMode('reset')
    } catch (err) {
      setError(err.message || 'Unable to process password reset.')
    } finally {
      setLoading(false)
    }
  }

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
      setSuccessMsg('Your password has been successfully reset! You can now sign in.')
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

  return (
    <div className={`login-split-page ref-theme-page ${isLoggingInSuccess ? 'page-logging-in-success' : ''}`}>
      {/* Quick Theme Switcher Button */}
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span>Light</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>Dark</span>
          </>
        )}
      </button>

      {/* LEFT SIDE: Centered Showcase with Hotel Circles & Full Photo Lightbox */}
      <section className="login-illustration-column" aria-label="HORECAOS Hotel and Restaurant Showcase">
        <LoginIllustration isLoggingInSuccess={isLoggingInSuccess} />
      </section>

      {/* RIGHT SIDE: Clean Modern Form */}
      <section className="login-form-column" aria-label="Sign In to HORECAOS Hotel & Restaurant System">
        <div className="login-card-container">
          {/* ================================================================ */}
          {/* 1. TWO-FACTOR AUTHENTICATION VIEW                                */}
          {/* ================================================================ */}
          {is2FA ? (
            <form className="login-card ref-card" onSubmit={submit2FA}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <Building2 size={24} color="#ffffff" />
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">HORECA</span>
                  <span className="brand-dev">OS</span>
                  <span className="brand-sub-chip">Two-Factor Auth</span>
                </div>
              </div>

              <h1 className="ref-form-title">VERIFY ACCESS</h1>
              <p className="ref-form-sub">
                Enter your 6-digit Google Authenticator code for{' '}
                <strong style={{ color: '#513AB3' }}>{email}</strong>.
              </p>

              {error && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="ref-field-group">
                <label className="ref-label">Authenticator Code</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Key size={18} /></span>
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
                      letterSpacing: 6,
                      fontFamily: 'monospace',
                    }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`ref-action-btn ${isLoggingInSuccess ? 'btn-success-active' : ''}`}
                disabled={loading || twoFactorCode.length < 6 || isLoggingInSuccess}
              >
                {isLoggingInSuccess ? (
                  <>
                    <Check size={18} />
                    <span>Access Granted…</span>
                  </>
                ) : (
                  <span>{loading ? 'Verifying…' : 'Sign In'}</span>
                )}
              </button>

              <button
                type="button"
                className="ref-secondary-btn"
                onClick={cancel2FA}
                disabled={loading || isLoggingInSuccess}
              >
                ← Back to Sign In
              </button>
            </form>
          ) : mode === 'forgot' ? (
            /* ================================================================ */
            /* 2. FORGOT PASSWORD VIEW                                          */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={handleForgotPassword}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <Building2 size={24} color="#ffffff" />
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">HORECA</span>
                  <span className="brand-dev">OS</span>
                  <span className="brand-sub-chip">Reset</span>
                </div>
              </div>

              <h1 className="ref-form-title">FORGOT PASSWORD</h1>
              <p className="ref-form-sub">Enter your hotel staff email to receive password reset instructions.</p>

              {error && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="login-notice">
                  <CheckCircle size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="ref-field-group">
                <label className="ref-label">E-mail</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Mail size={18} /></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your enterprise email"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="ref-action-btn" disabled={loading}>
                <span>{loading ? 'Sending…' : 'Send Instructions'}</span>
              </button>

              <button
                type="button"
                className="ref-secondary-btn"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                disabled={loading}
              >
                ← Back to Sign In
              </button>
            </form>
          ) : mode === 'reset' ? (
            /* ================================================================ */
            /* 3. RESET PASSWORD VIEW                                          */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={handleResetPassword}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <Building2 size={24} color="#ffffff" />
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">HORECA</span>
                  <span className="brand-dev">OS</span>
                  <span className="brand-sub-chip">Security</span>
                </div>
              </div>

              <h1 className="ref-form-title">SET NEW PASSWORD</h1>
              <p className="ref-form-sub">Create a secure password for your hotel & restaurant account.</p>

              {error && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="login-notice">
                  <Info size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="ref-field-group">
                <label className="ref-label">Reset Verification Token</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Tag size={18} /></span>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token here"
                    required
                  />
                </div>
              </div>

              <div className="ref-field-group">
                <label className="ref-label">New Password</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Lock size={18} /></span>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    className={`ref-peek-btn${showResetPass ? ' active' : ''}`}
                    onClick={handleToggleShowResetPassword}
                    title={showResetPass ? `Visible for ${resetSecondsLeft}s` : 'Show password for 5 seconds'}
                    tabIndex={0}
                  >
                    {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showResetPass ? `${resetSecondsLeft}s` : 'Show'}</span>
                  </button>
                </div>
              </div>

              <div className="ref-field-group">
                <label className="ref-label">Confirm Password</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Lock size={18} /></span>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="ref-action-btn" disabled={loading}>
                <span>{loading ? 'Updating…' : 'Update & Sign In'}</span>
              </button>

              <button
                type="button"
                className="ref-secondary-btn"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                disabled={loading}
              >
                ← Back to Sign In
              </button>
            </form>
          ) : (
            /* ================================================================ */
            /* 4. STANDARD LOGIN VIEW                                           */
            /* ================================================================ */
            <form className="login-card ref-card" onSubmit={submit}>
              {/* Brand Header */}
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <Building2 size={24} color="#ffffff" />
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">HORECA</span>
                  <span className="brand-dev">OS</span>
                  <span className="brand-sub-chip">Hotel & Restaurant</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="ref-form-title">SIGN IN NOW</h1>
              <p className="ref-form-sub">Sign in to your HORECAOS Hotel & Restaurant System account</p>

              {/* Notice Banners */}
              {displayNotice && !error && !successMsg && (
                <div className="login-notice">
                  <Clock size={16} />
                  <span>{displayNotice}</span>
                </div>
              )}

              {successMsg && (
                <div className="login-notice">
                  <CheckCircle size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              {lockoutSeconds > 0 && (
                <div className="login-lockout-banner">
                  <Lock size={20} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Account temporarily locked.</div>
                    <div style={{ fontSize: 11.5, marginTop: 2 }}>
                      Please wait <strong>{lockoutSeconds}s</strong> before trying again.
                    </div>
                  </div>
                </div>
              )}

              {error && lockoutSeconds === 0 && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. E-mail Input Field */}
              <div className="ref-field-group">
                <label className="ref-label">E-mail</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Mail size={18} /></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    disabled={loading || isLoggingInSuccess}
                  />
                </div>
              </div>

              {/* 2. Password Input Field */}
              <div className="ref-field-group">
                <label className="ref-label">Password</label>
                <div className="ref-input-box">
                  <span className="ref-input-icon"><Lock size={18} /></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading || isLoggingInSuccess}
                  />
                  {/* Password Peek Toggle */}
                  <button
                    type="button"
                    className={`ref-peek-btn${showPassword ? ' active' : ''}`}
                    onClick={handleToggleShowPassword}
                    title={showPassword ? `Visible for ${secondsLeft}s (auto-hides)` : 'Show password for 5 seconds'}
                    tabIndex={0}
                    disabled={isLoggingInSuccess}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showPassword ? `${secondsLeft}s` : 'Show'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Forgot Password Link */}
              <div className="ref-forgot-row">
                <button
                  type="button"
                  className="ref-forgot-link"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg('') }}
                  disabled={isLoggingInSuccess}
                >
                  Forgot password?
                </button>
              </div>

              {/* 4. Login Action Button */}
              <button
                type="submit"
                className={`ref-action-btn ${isLoggingInSuccess ? 'btn-success-active' : ''}`}
                disabled={loading || lockoutSeconds > 0 || isLoggingInSuccess}
              >
                {isLoggingInSuccess ? (
                  <>
                    <Check size={18} />
                    <span>Access Granted…</span>
                  </>
                ) : (
                  <span>{loading ? 'Signing in…' : lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Login'}</span>
                )}
              </button>
            </form>
          )}

          {/* Copyright Notice */}
          <div className="login-copyright-note">
            © {new Date().getFullYear()} HORECAOS Hotel and Restaurant. All rights reserved.
          </div>
        </div>
      </section>
    </div>
  )
}
