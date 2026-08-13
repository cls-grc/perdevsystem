import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { RECOGNITION_BADGES, RECOGNITION_CATEGORIES, QUICK_COMMENTS } from '../workflowConfig'

export default function BadgePickerModal({ isOpen, onClose, onSuccess, employees = [] }) {
  const [selectedBadge, setSelectedBadge] = useState(RECOGNITION_BADGES[0].id)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [category, setCategory] = useState(RECOGNITION_CATEGORIES[0])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('pds-user') || '{}')
    } catch {
      return {}
    }
  })()

  useEffect(() => {
    if (isOpen && employees.length > 0 && !selectedSubjectId) {
      // Pick first employee by default if none selected
      setSelectedSubjectId(employees[0].id)
    }
  }, [isOpen, employees, selectedSubjectId])

  if (!isOpen) return null

  const activeBadge = RECOGNITION_BADGES.find(b => b.id === selectedBadge) || RECOGNITION_BADGES[0]

  const handleQuickComment = (chipText) => {
    setReason(prev => prev ? `${prev} ${chipText}.` : `${chipText}.`)
  }

  const handleAiGenerateReason = () => {
    const nomineeName = employees.find(e => e.id === selectedSubjectId)?.full_name || 'the employee'
    const generated = `Consistently demonstrates exemplary ${category.toLowerCase()} and teamwork in hospitality service. ${nomineeName} went above and beyond for our guests and team, embodying true excellence.`
    setReason(generated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSubjectId) {
      setError('Please select an employee to recognize.')
      return
    }
    if (!reason.trim()) {
      setError('Please provide a reason or citation for this nomination.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const targetEmp = employees.find(e => e.id === selectedSubjectId)
      const nominatorName = currentUser.name || currentUser.full_name || 'Colleague'

      await api.createWorkflow({
        module: 'recognition',
        subjectEmployeeId: selectedSubjectId,
        title: `${activeBadge.name} — Nominated by ${nominatorName}`,
        metadata: {
          badgeId: activeBadge.id,
          badgeName: activeBadge.name,
          badgeTier: activeBadge.tier,
          badgeIcon: activeBadge.icon,
          badgePoints: activeBadge.points,
          category,
          reason,
          nominatorName,
          nominatorRole: currentUser.role || 'employee',
          nomineeName: targetEmp?.full_name || 'Employee',
          nomineeDepartment: targetEmp?.department || 'Operations',
        },
      })

      if (onSuccess) {
        onSuccess(`Nomination submitted successfully! ${activeBadge.icon} ${activeBadge.name} for ${targetEmp?.full_name || 'Employee'}.`)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to submit recognition nomination.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Nominate Employee for Social Recognition"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 12, 30, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="badge-picker-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(620px, 95vw)',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e5e2f0',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #1e1b2e, #2d264a)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏆</span> Nominate & Issue Recognition Badge
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#b6b0d6' }}>
              Recognize outstanding hospitality achievements & reward team members.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 24, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* 1. Employee Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Select Employee to Recognize *
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
                backgroundColor: '#f9fafb',
              }}
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.department} · {emp.job_title || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Visual Badge Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Select Badge Tier & Award *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {RECOGNITION_BADGES.map(badge => {
                const isSelected = selectedBadge === badge.id
                return (
                  <div
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge.id)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: `2px solid ${isSelected ? badge.color : '#e5e7eb'}`,
                      backgroundColor: isSelected ? badge.bg : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      boxShadow: isSelected ? `0 4px 12px ${badge.color}25` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{badge.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: badge.color }}>{badge.name}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontWeight: 600 }}>+{badge.points} pts</div>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>
              💡 {activeBadge.description}
            </p>
          </div>

          {/* 3. Category Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Recognition Category *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
                backgroundColor: '#f9fafb',
              }}
            >
              {RECOGNITION_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 4. Citation / Reason Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Citation / Reason for Nomination *
              </label>
              <button
                type="button"
                onClick={handleAiGenerateReason}
                style={{
                  background: '#f3e8ff',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  borderRadius: 14,
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✦ Auto-fill AI Reason
              </button>
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the exceptional effort or achievement that merits this award..."
              rows={3}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />

            {/* Quick Comment Chips */}
            <div style={{ marginTop: 8 }}>
              <small style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Quick Citation Suggestions:
              </small>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(QUICK_COMMENTS.recognition || []).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickComment(chip)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      color: '#4b5563',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #654bd2, #4f32c2)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(101, 75, 210, 0.3)',
              }}
            >
              {submitting ? 'Submitting Nomination...' : `Issue ${activeBadge.icon} Nomination`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
