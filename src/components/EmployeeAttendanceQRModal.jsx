import React, { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import QRCodeImage from './QRCodeImage'
import { api } from '../lib/api'
import {
  X, Camera, QrCode, UserCheck, ShieldCheck, CheckCircle2, AlertCircle,
  RefreshCw, Volume2, VolumeX, Sparkles, Printer, User, Calendar, Check, ArrowRight
} from 'lucide-react'

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

export default function EmployeeAttendanceQRModal({ user, onClose, onAttendanceUpdated, activeSessions = [] }) {
  const [activeTab, setActiveTab] = useState('my_badge') // 'my_badge' | 'scan_session'
  const [cameraActive, setCameraActive] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Active target session for check-in
  const scheduledSessions = activeSessions.filter(s => s.status !== 'cancelled' && s.status !== 'completed')
  const [targetSessionId, setTargetSessionId] = useState(() => scheduledSessions[0]?.id || activeSessions[0]?.id || '')

  const [scanningStatus, setScanningStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [lastSuccessData, setLastSuccessData] = useState(null)
  const [recentScans, setRecentScans] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameId = useRef(null)
  const isProcessingRef = useRef(false)
  const lastScannedCodeRef = useRef('')
  const lastScannedTimeRef = useRef(0)

  // Employee Badge QR payload
  const badgePayload = JSON.stringify({
    type: 'pds_employee_badge',
    employeeId: user.employeeId || user.id,
    employeeNumber: user.employeeNumber || user.employee_number || 'E001',
    name: user.name || user.full_name,
    role: user.role
  })

  // Universal Scanner Handler (Handles BOTH Session Passes and Employee Badges)
  const handleProcessScan = useCallback(async (scannedData) => {
    if (!scannedData) return
    const now = Date.now()
    if (scannedData === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 2500) {
      return
    }
    lastScannedCodeRef.current = scannedData
    lastScannedTimeRef.current = now

    isProcessingRef.current = true
    setScanningStatus('processing')
    setStatusMessage('Analyzing scanned QR code...')

    try {
      // ═════════════════════════════════════════════════════════════════
      // CASE 1: SCANNED A SESSION PASS (Self-Check-In Mode)
      // ═════════════════════════════════════════════════════════════════
      let parsedSessionId = null
      if (scannedData.includes('checkin=')) {
        const match = scannedData.match(/checkin=([a-zA-Z0-9_-]+)/)
        if (match && match[1]) parsedSessionId = match[1]
      }

      if (!parsedSessionId) {
        try {
          const parsed = JSON.parse(scannedData)
          if (parsed.type === 'pds_training_session' || parsed.sessionId) {
            parsedSessionId = parsed.sessionId || parsed.id
          }
        } catch {}
      }

      if (parsedSessionId) {
        const res = await api.selfCheckinTrainingSession(parsedSessionId, {
          employeeId: user.employeeId || user.id
        })
        if (res.success) {
          if (soundEnabled) playSuccessChime()
          setScanningStatus('success')
          const title = res.session?.title || 'Training Session'
          setStatusMessage('Your attendance is recorded! You are marked PRESENT.')
          setLastSuccessData({
            sessionTitle: title,
            employeeName: user.name,
            employeeNumber: user.employeeNumber || user.employee_number || 'E001',
            venue: res.session?.venue || 'Training Venue',
            time: new Date().toLocaleTimeString(),
          })
          setRecentScans(prev => [
            {
              id: 'scan-' + Date.now(),
              title,
              name: user.name,
              time: new Date().toLocaleTimeString(),
              type: 'self_session'
            },
            ...prev
          ])
          if (onAttendanceUpdated) onAttendanceUpdated()
        }
        return
      }

      // ═════════════════════════════════════════════════════════════════
      // CASE 2: SCANNED AN EMPLOYEE BADGE (Supervisor / Peer Scanner)
      // ═════════════════════════════════════════════════════════════════
      const activeSessId = targetSessionId || scheduledSessions[0]?.id || activeSessions[0]?.id

      if (!activeSessId) {
        setScanningStatus('error')
        setStatusMessage('No active training session selected.')
        return
      }

      const res = await api.scanTrainingAttendance(activeSessId, {
        code: scannedData,
        status: 'present'
      })

      if (res.success) {
        if (soundEnabled) playSuccessChime()
        setScanningStatus('success')
        const title = activeSessions.find(s => s.id === activeSessId)?.title || 'Training Session'
        const empName = res.employee?.full_name || 'Employee'
        const empNum = res.employee?.employee_number || ''
        setStatusMessage('Your attendance is recorded: ' + empName + ' (' + empNum + ') — PRESENT')
        setLastSuccessData({
          sessionTitle: title,
          employeeName: empName,
          employeeNumber: empNum,
          venue: activeSessions.find(s => s.id === activeSessId)?.venue || 'Training Venue',
          time: new Date().toLocaleTimeString(),
        })
        setRecentScans(prev => [
          {
            id: 'scan-' + Date.now(),
            title,
            name: empName + ' (' + empNum + ')',
            time: new Date().toLocaleTimeString(),
            type: 'employee_badge'
          },
          ...prev.filter(l => !l.name?.startsWith(empName))
        ])
        if (onAttendanceUpdated) onAttendanceUpdated()
      }
    } catch (err) {
      setScanningStatus('error')
      setStatusMessage(err.message || 'QR code could not be verified.')
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false
      }, 1500)
    }
  }, [user, soundEnabled, onAttendanceUpdated, targetSessionId, scheduledSessions, activeSessions])

  // Camera video loop with jsQR
  useEffect(() => {
    if (activeTab !== 'scan_session' || !cameraActive || lastSuccessData) {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
      return
    }

    let streamInstance = null
    let active = true

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
    })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamInstance = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.play().catch(() => {})
        }
        setCameraError('')
      })
      .catch(err => {
        setCameraError('Camera access denied or unavailable.')
      })

    const scanFrame = () => {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !isProcessingRef.current) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (qrCode && qrCode.data) {
          handleProcessScan(qrCode.data)
        }
      }
      animFrameId.current = requestAnimationFrame(scanFrame)
    }

    animFrameId.current = requestAnimationFrame(scanFrame)

    return () => {
      active = false
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop())
      }
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
    }
  }, [activeTab, cameraActive, facingMode, handleProcessScan, lastSuccessData])

  const initials = user.name
    ? (user.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()
    : 'EM'

  const selectedSessionObj = activeSessions.find(s => s.id === targetSessionId) || scheduledSessions[0]

  return (
    <div className="training-modal-overlay" role="dialog" aria-modal="true">
      <div className="training-modal-content qr-attendance-modal" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className="training-modal-header" style={{ padding: '16px 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="session-category-tag" style={{ margin: 0 }}>TRAINING ATTENDANCE</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                LIVE QR
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Attendance &amp; Check-In</h3>
            <small style={{ color: '#64748b' }}>
              Employee ID: <b>{user.employeeNumber || user.employee_number || 'E001'}</b> · {user.name}
            </small>
          </div>
          <button className="training-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="qr-tabs-nav">
          <button className={'qr-tab-btn ' + (activeTab === 'my_badge' ? 'active' : '')} onClick={() => { setActiveTab('my_badge'); setLastSuccessData(null); }}>
            <QrCode size={14} /> My Digital Badge
          </button>
          <button className={'qr-tab-btn ' + (activeTab === 'scan_session' ? 'active' : '')} onClick={() => setActiveTab('scan_session')}>
            <Camera size={14} /> Live Camera Scanner
          </button>
        </div>

        {/* Tab 1: MY DIGITAL QR BADGE */}
        {activeTab === 'my_badge' && (
          <div className="qr-session-display-wrap" style={{ padding: '20px 16px' }}>
            <div className="qr-session-display-card" style={{ maxWidth: 440, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, textAlign: 'left' }}>
                <span className="avatar avatar-lia" style={{ width: 44, height: 44, fontSize: 15, fontWeight: 800 }}>
                  {initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 16, color: '#1e1b4b' }}>{user.name}</b>
                  <small style={{ color: '#6366f1', fontWeight: 700, fontSize: 12 }}>
                    ID: {user.employeeNumber || user.employee_number || 'E001'} · {(user.role || '').toUpperCase()}
                  </small>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  ACTIVE
                </span>
              </div>

              {/* QR Code Container */}
              <div className="qr-code-large-box" style={{ margin: '8px auto', padding: 16 }}>
                <QRCodeImage value={badgePayload} size={200} />
                <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Employee Badge QR
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', margin: '12px auto 0', textAlign: 'center', fontSize: 12 }}>
                <b style={{ display: 'block', color: '#1e1b4b', marginBottom: 2 }}>How to use:</b>
                <p style={{ margin: 0, color: '#64748b' }}>
                  Show this QR badge to your HR trainer or supervisor to mark your attendance as <strong>PRESENT</strong>.
                </p>
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="session-action-btn"
                  style={{ width: '100%', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '8px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8 }}
                  onClick={() => setActiveTab('scan_session')}
                >
                  <Camera size={14} className="inline mr-1" /> Need to scan? Open Camera Scanner →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: LIVE CAMERA SCANNER (Universal Scanner) */}
        {activeTab === 'scan_session' && (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* FULL SUCCESS CONFIRMATION VIEW */}
            {lastSuccessData ? (
              <div style={{ background: '#ffffff', border: '2px solid #10b981', borderRadius: 16, padding: '24px 20px', textAlign: 'center', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)', animation: 'qrItemPop 0.25s ease' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                  <CheckCircle2 size={38} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 20, color: '#15803d', fontWeight: 800 }}>
                  Your Attendance is Recorded!
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#334155' }}>
                  You are successfully marked as <strong style={{ color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>PRESENT</strong>
                </p>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', textAlign: 'left', fontSize: 12.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
                  <div><small style={{ color: '#64748b' }}>Session:</small><br/><b>{lastSuccessData.sessionTitle}</b></div>
                  <div><small style={{ color: '#64748b' }}>Attendee:</small><br/><b>{lastSuccessData.employeeName}</b></div>
                  <div><small style={{ color: '#64748b' }}>Venue:</small><br/><span>{lastSuccessData.venue}</span></div>
                  <div><small style={{ color: '#64748b' }}>Recorded At:</small><br/><span>{lastSuccessData.time}</span></div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                  <button
                    type="button"
                    className="session-action-btn primary"
                    style={{ padding: '8px 20px', fontSize: 13, background: '#10b981' }}
                    onClick={onClose}
                  >
                    ✓ Done
                  </button>
                  <button
                    type="button"
                    className="session-action-btn"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => {
                      setLastSuccessData(null)
                      setScanningStatus('idle')
                    }}
                  >
                    <Camera size={13} className="inline mr-1" /> Scan Another
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Session Selector (If multiple sessions exist) */}
                {scheduledSessions.length > 1 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: '#64748b' }}>Target Session for Badge Scans:</span>
                    <select
                      value={targetSessionId}
                      onChange={e => setTargetSessionId(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    >
                      {scheduledSessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({String(s.start_date).slice(0, 10)} @ {s.venue})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {selectedSessionObj && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <small style={{ color: '#64748b' }}>Active Session:</small><br/>
                      <b>{selectedSessionObj.title}</b>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#4338ca', fontWeight: 700 }}>
                      {selectedSessionObj.venue}
                    </span>
                  </div>
                )}

                <div className="qr-camera-column">
                  <div className="qr-camera-wrap" style={{ aspectRatio: '4/3' }}>
                    {cameraActive && !cameraError ? (
                      <>
                        <video ref={videoRef} className="qr-camera-feed" />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div className="qr-target-overlay">
                          <div className="qr-scan-corners" />
                          <div className="qr-laser-line" />
                          <div className="qr-scan-hint">Point at Employee Badge QR or Session QR Pass</div>
                        </div>
                      </>
                    ) : (
                      <div className="qr-camera-fallback">
                        <Camera size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13 }}>Camera scanner is paused.</p>
                        <small style={{ color: '#94a3b8' }}>{cameraError || 'Click below to turn camera back on.'}</small>
                        <button
                          type="button"
                          className="session-action-btn primary"
                          style={{ marginTop: 10, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => { setCameraError(''); setCameraActive(true) }}
                        >
                          <RefreshCw size={12} className="inline mr-1" /> Start Camera
                        </button>
                      </div>
                    )}

                    {scanningStatus !== 'idle' && (
                      <div className={'qr-scan-feedback ' + scanningStatus}>
                        {scanningStatus === 'processing' && <RefreshCw size={14} className="animate-spin" />}
                        {scanningStatus === 'success' && <CheckCircle2 size={16} />}
                        {scanningStatus === 'error' && <AlertCircle size={16} />}
                        <span>{statusMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="qr-camera-controls" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="qr-ctrl-btn"
                      onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                    >
                      <RefreshCw size={13} /> Flip Lens
                    </button>
                    <button
                      type="button"
                      className="qr-ctrl-btn"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                    >
                      {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                      {soundEnabled ? 'Chime ON' : 'Muted'}
                    </button>
                  </div>

                  {/* Recent Scan History */}
                  {recentScans.length > 0 && (
                    <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
                      <small style={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>Recent Activity</small>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        {recentScans.slice(0, 3).map(scan => (
                          <div key={scan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                            <span><b>{scan.name}</b> · {scan.title}</span>
                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>✓ {scan.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
