import React, { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const SAMPLE_PROMPTS_BY_ROLE = {
  hr: [
    "Who had the highest performance score this year?",
    "Which department has the largest competency gap?",
    "Which employees have incomplete learning activities?",
    "Which employees are Ready Now for succession?",
    "What learning resources are related to customer service competency?",
  ],
  management: [
    "Who had the highest performance score this year?",
    "Which department has the largest competency gap?",
    "Which employees are Ready Now for succession?",
    "What is the average performance across the organization?",
  ],
  operations_manager: [
    "Which employees in my department have competency gaps?",
    "Show incomplete learning activities in my department.",
    "Which department team members have top performance?",
  ],
  supervisor: [
    "Which employees in my department have competency gaps?",
    "Show incomplete learning activities in my department.",
    "Which employees have recommended learning paths?",
  ],
  employee: [
    "What was my last performance score?",
    "What learning activities do I still need to complete?",
    "What competencies should I improve?",
    "What is my coworker's performance score?",
  ],
}

/**
 * Format markdown text: converts single asterisks (*word*) and double asterisks (**word**)
 * into strong bold elements, and renders lists and headers cleanly.
 */
function renderFormattedContent(text = '') {
  if (!text) return null

  // Normalize single asterisks surrounding words to double asterisks for bolding
  // e.g. *Identify Learning Needs:* -> **Identify Learning Needs:**
  let normalized = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '**$1**')

  const lines = normalized.split('\n')

  return lines.map((line, lineIdx) => {
    // Handle headings (e.g. ### Action Steps or ## Header)
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/)
    if (headingMatch) {
      return (
        <h4 key={lineIdx} style={{ margin: '10px 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1e1b2e' }}>
          {parseInlineBold(headingMatch[1])}
        </h4>
      )
    }

    // Handle bullet / numbered list items (e.g. 1. item or - item or • item)
    const listMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      return (
        <div key={lineIdx} style={{ paddingLeft: 8, margin: '4px 0', display: 'flex', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#654bd2', minWidth: 16 }}>{listMatch[2]}</span>
          <span style={{ flex: 1 }}>{parseInlineBold(listMatch[3])}</span>
        </div>
      )
    }

    // Empty line spacing
    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: 4 }} />
    }

    return (
      <div key={lineIdx} style={{ margin: '2px 0' }}>
        {parseInlineBold(line)}
      </div>
    )
  })
}

function parseInlineBold(text) {
  // Split by **bold** text blocks
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ fontWeight: 700, color: '#1e1b2e' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function AIChatDrawer({ isOpen, onClose }) {
  const role = (() => { try { return JSON.parse(localStorage.getItem('pds-user') || '{}').role || 'employee' } catch { return 'employee' } })()
  const samples = SAMPLE_PROMPTS_BY_ROLE[role] || SAMPLE_PROMPTS_BY_ROLE.employee

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your database-grounded AI Assistant. I can analyze system records, performance scores, skill gaps, learning paths, and succession data scoped to your authorized role (${role.replace('_', ' ').toUpperCase()}).`,
      summary: 'Database-grounded initialization',
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [dataContextSummary, setDataContextSummary] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  if (!isOpen) return null

  const handleSend = async (textToSend) => {
    const prompt = (textToSend || input).trim()
    if (!prompt || sending) return

    setInput('')
    setError('')
    const newMsg = { role: 'user', content: prompt }
    const nextHistory = [...messages, newMsg]
    setMessages(nextHistory)
    setSending(true)

    try {
      const historyPayload = nextHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))

      const response = await api.chatAssistant({
        message: prompt,
        history: historyPayload,
      })

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          summary: response.dataContextSummary,
        }
      ])
      if (response.dataContextSummary) {
        setDataContextSummary(response.dataContextSummary)
      }
    } catch (err) {
      setError(err.message || 'Could not retrieve AI response.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="AI Chat Assistant" onClick={onClose}>
      <aside
        className="settings-dialog ai-chat-drawer"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(580px, 92vw)',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div className="ai-chat-header" style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1e1b2e, #2d264a)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <h2 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Database-Grounded AI Assistant</h2>
            </div>
            <small style={{ color: '#b6b0d6', fontSize: 11 }}>
              Strict Database Grounding · Role Scope: <b style={{ textTransform: 'uppercase', color: '#8f7bf0' }}>{role}</b>
            </small>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 22, cursor: 'pointer' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Data Scope & Security Banner */}
        <div style={{
          padding: '8px 16px',
          background: '#f4f2fb',
          borderBottom: '1px solid #e5e2f0',
          fontSize: 11,
          color: '#554f6b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>🔒 Authorized Data Pipeline Active</span>
          <span style={{ fontWeight: 600, color: '#654bd2' }}>{dataContextSummary || 'Grounded DB Context'}</span>
        </div>

        {/* Messages Body */}
        <div className="ai-chat-body" style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#faf9fc',
        }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`ai-message ${m.role}`}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: m.role === 'user' ? '#654bd2' : '#ffffff',
                color: m.role === 'user' ? '#ffffff' : '#282631',
                boxShadow: '0 2px 8px rgba(40,34,70,0.04)',
                border: m.role === 'user' ? 'none' : '1px solid #ecebf0',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ fontSize: 10, color: '#8e8b95', marginBottom: 4, fontWeight: 700, display: 'flex', gap: 6 }}>
                  <span>✦ AI ASSISTANT</span>
                  {m.summary && <span>· {m.summary}</span>}
                </div>
              )}
              <div>{renderFormattedContent(m.content)}</div>
            </div>
          ))}

          {sending && (
            <div className="ai-message assistant" style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 2px',
              background: '#ffffff',
              border: '1px solid #ecebf0',
              fontSize: 12,
              color: '#8e8b95',
            }}>
              ✦ Querying authorized database records & generating grounded response…
            </div>
          )}

          {error && (
            <div style={{ padding: 10, background: '#fff0ee', color: '#b23a2f', borderRadius: 8, fontSize: 11 }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Strip */}
        <div style={{ padding: '8px 14px', background: '#fff', borderTop: '1px solid #ecebf0' }}>
          <small style={{ fontSize: 10, color: '#8e8b95', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Suggested Database Queries:
          </small>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {samples.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={sending}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 10px',
                  borderRadius: 16,
                  border: '1px solid #e4e1f5',
                  background: '#f8f6ff',
                  color: '#654bd2',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                ⚡ {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => { e.preventDefault(); handleSend() }}
          style={{
            padding: 12,
            background: '#fff',
            borderTop: '1px solid #ecebf0',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about database metrics, performance, skill gaps, or learning…"
            disabled={sending}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #dfdce6',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: '#654bd2',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              opacity: sending || !input.trim() ? 0.6 : 1,
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </aside>
    </div>
  )
}
