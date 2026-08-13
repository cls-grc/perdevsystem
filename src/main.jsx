import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }
  handleResetSession = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.href = '/'
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc', color: '#1e293b', padding: '24px'
        }}>
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
            padding: '36px 40px', maxWidth: '560px', width: '100%', textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚡</div>
            <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '20px', fontWeight: '700' }}>Application Error</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
              An unexpected render error occurred. You can retry loading or clear your local session cache below.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
              <button
                onClick={() => { this.setState({ error: null }); window.location.reload() }}
                style={{
                  background: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                }}
              >
                ↻ Refresh Page
              </button>
              <button
                onClick={this.handleResetSession}
                style={{
                  background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px',
                  padding: '10px 20px', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                }}
              >
                🧹 Clear Session & Sign In
              </button>
            </div>
            <div style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error diagnostic:</span>
              <pre style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', marginBottom: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {this.state.error?.toString() || 'Unknown error'}
              </pre>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
