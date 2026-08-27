import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import LoginIllustration from '../components/LoginIllustration'
import { Key, Eye, EyeOff, Tag, AlertTriangle, CheckCircle, Clock, Lock, Info } from 'lucide-react'

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Pick up session notice from sessionStorage (written by handleLogout before the hard reload)
  const [sessionNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('pds-session-notice') || ''
      if (msg) sessionStorage.removeItem('pds-session-notice')
      return msg
    } catch { return '' }
  })

  const displayNotice = sessionNotice || notice || ''

  // Dark / Light Mode state for Login Screen toggle
  const [isDark, setIsDark] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('pds-theme') === 'dark'
    } catch {
      return true
    }
  })

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    const root = document.documentElement
    if (nextDark) {
      root.classList.add('dark')
      try { localStorage.setItem('pds-theme', 'dark') } catch {}
    } else {
      root.classList.remove('dark')
      try { localStorage.setItem('pds-theme', 'light') } catch {}
    }
  }

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

  // Login Success Portal Exit Transition State
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

  // 5-second password peek handler for Reset Password
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

      // Trigger Hotel Entrance & VIP Access Hologram Zoom Transition
      setIsLoggingInSuccess(true)
      setTimeout(() => {
        onLogin(result.user)
      }, 1480)
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

      // Trigger Hotel Entrance & VIP Access Hologram Zoom Transition
      setIsLoggingInSuccess(true)
      setTimeout(() => {
        onLogin(result.user)
      }, 1350)
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

  const isEyesClosed = showPassword || showResetPass

  return (
    <div className="login-split-page">
      {/* Quick Theme Switcher Button (Top Right) */}
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

      {/* LEFT SIDE: Seamless 3D Illustration Hero */}
      <section className="login-illustration-column" aria-label="PerDevSys Workforce Development Illustration">
        <LoginIllustration
          isPasswordVisible={isEyesClosed}
          isLoading={loading}
          isLoggingInSuccess={isLoggingInSuccess}
          isDark={isDark}
        />
      </section>

      {/* RIGHT SIDE: Authentication Form Card */}
      <section className="login-form-column" aria-label="Sign In to PerDevSys">
        <div className="login-card-container">
          {/* ================================================================ */}
          {/* 1. TWO-FACTOR AUTHENTICATION VIEW                                */}
          {/* ================================================================ */}
          {is2FA ? (
            <form className="login-card" onSubmit={submit2FA}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">Per</span>
                  <span className="brand-dev">Dev</span>
                  <span className="brand-sys">Sys</span>
                </div>
              </div>

              <h1>Two-Factor Auth</h1>
              <p>
                Enter the 6-digit verification code from your <strong>Google Authenticator</strong> app for{' '}
                <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{email}</span>.
              </p>

              {error && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <label>
                Authenticator Code
                <div className="login-input-wrap">
                  <span className="login-input-icon"><Key size={18} /></span>
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
              </label>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading || twoFactorCode.length < 6}
              >
                <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                className="login-secondary-btn"
                onClick={cancel2FA}
                disabled={loading}
              >
                ← Back to Login
              </button>
            </form>
          ) : mode === 'forgot' ? (
            /* ================================================================ */
            /* 2. FORGOT PASSWORD VIEW                                          */
            /* ================================================================ */
            <form className="login-card" onSubmit={handleForgotPassword}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="m10.85 12.15 7.65-7.65a1.5 1.5 0 0 1 2.12 0l1.41 1.41a1.5 1.5 0 0 1 0 2.12L19 11l-2-2-1.5 1.5 2 2-2 2" />
                  </svg>
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">Per</span>
                  <span className="brand-dev">Dev</span>
                  <span className="brand-sys">Sys</span>
                </div>
              </div>

              <h1>Forgot Password</h1>
              <p>Enter your registered enterprise email to receive password reset instructions.</p>

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

              <label>
                Email
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </label>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                <span>{loading ? 'Sending Instructions…' : 'Reset password'}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                className="login-secondary-btn"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                disabled={loading}
              >
                ← Back to Sign In
              </button>
            </form>
          ) : mode === 'reset' ? (
            /* ================================================================ */
            /* 3. RESET PASSWORD VIEW                                           */
            /* ================================================================ */
            <form className="login-card" onSubmit={handleResetPassword}>
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">Per</span>
                  <span className="brand-dev">Dev</span>
                  <span className="brand-sys">Sys</span>
                </div>
              </div>

              <h1>Set New Password</h1>
              <p>Create a secure password for your staff or management profile.</p>

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

              <label>
                Reset Verification Token
                <div className="login-input-wrap">
                  <span className="login-input-icon"><Tag size={18} /></span>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token here"
                    required
                  />
                </div>
              </label>

              <label style={{ marginBottom: 0 }}>
                New Password
                <div className="login-password-field">
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type={showResetPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className={`password-toggle${showResetPass ? ' active' : ''}`}
                    onClick={handleToggleShowResetPassword}
                    title={showResetPass ? `Visible for ${resetSecondsLeft}s` : 'Show password for 5 seconds'}
                    tabIndex={0}
                  >
                    <span className="password-toggle-icon">{showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}</span>
                    <span className="password-toggle-label">{showResetPass ? `${resetSecondsLeft}s` : 'Show'}</span>
                  </button>
                </div>
              </label>

              <label>
                Confirm New Password
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                  />
                </div>
              </label>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                <span>{loading ? 'Updating Password…' : 'Update & Sign In'}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                className="login-secondary-btn"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}
                disabled={loading}
              >
                ← Back to Login
              </button>
            </form>
          ) : (
            /* ================================================================ */
            /* 4. STANDARD LOGIN VIEW                                           */
            /* ================================================================ */
            <form className="login-card" onSubmit={submit}>
              {/* Brand Header */}
              <div className="login-brand-header">
                <div className="login-brand-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                      stroke="#fff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="2.2" />
                    <path
                      d="M22 21v-2a4 4 0 0 0-3-3.87"
                      stroke="#fff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 3.13a4 4 0 0 1 0 7.75"
                      stroke="#fff"
                      strokeWidth="2.2"
                    />
                  </svg>
                </div>
                <div className="login-brand-text">
                  <span className="brand-per">HORECA</span>
                  <span className="brand-sys">OS</span>
                  <span className="brand-sub-chip">Hotel & Restaurant</span>
                </div>
              </div>

              <h1>Welcome to HORECAOS</h1>
              <p>Sign in to your luxury hotel & restaurant workforce account</p>

              {/* Inactivity Notice Banner */}
              {displayNotice && !error && !successMsg && (
                <div className="login-notice">
                  <Clock size={16} />
                  <span>{displayNotice}</span>
                </div>
              )}

              {/* Success Message Banner */}
              {successMsg && (
                <div className="login-notice">
                  <CheckCircle size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Lockout Banner */}
              {lockoutSeconds > 0 && (
                <div className="login-lockout-banner">
                  <Lock size={20} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Account temporarily locked (3 failed attempts).</div>
                    <div style={{ fontSize: 11.5, marginTop: 3 }}>
                      Please wait <strong>{lockoutSeconds} second{lockoutSeconds === 1 ? '' : 's'}</strong> before trying again.
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Error Banner */}
              {error && lockoutSeconds === 0 && (
                <div className="login-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Input Field */}
              <label>
                Email
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
              </label>

              {/* Password Input Field */}
              <label style={{ marginBottom: 0 }}>
                Password
                <div className="login-password-field">
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="button"
                    className={`password-toggle${showPassword ? ' active' : ''}`}
                    onClick={handleToggleShowPassword}
                    title={showPassword ? `Visible for ${secondsLeft}s (auto-hides)` : 'Show password for 5 seconds'}
                    tabIndex={0}
                  >
                    <span className="password-toggle-icon">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</span>
                    <span className="password-toggle-label">{showPassword ? `${secondsLeft}s` : 'Show'}</span>
                  </button>
                </div>
              </label>

              {/* Forgot Password Link */}
              <div className="login-forgot-row">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg('') }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading || lockoutSeconds > 0}
              >
                <span>{loading ? 'Signing in…' : lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Sign in'}</span>
                {!loading && lockoutSeconds === 0 && <span>→</span>}
              </button>

            </form>
          )}

          {/* Copyright Notice */}
          <div className="login-copyright-note">
            © {new Date().getFullYear()} PerDevSys. All rights reserved.
          </div>
        </div>
      </section>
    </div>
  )
}
