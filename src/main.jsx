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
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif', background: '#f9f8ff', color: '#3f3d56', padding: '32px'
        }}>
          <div style={{
            background: '#fff', border: '1px solid #e4e1f7', borderRadius: '16px',
            padding: '40px 48px', maxWidth: '480px', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(114,84,227,.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', color: '#2b2933' }}>Something went wrong</h2>
            <p style={{ margin: '0 0 24px', color: '#7c778a', fontSize: '14px' }}>
              The page encountered an unexpected error. Please refresh to try again.
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              style={{
                background: '#7254e3', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 24px', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
              }}
            >
              Refresh Page
            </button>
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary style={{ fontSize: '12px', color: '#9b97a6', cursor: 'pointer' }}>Error details</summary>
              <pre style={{ fontSize: '11px', color: '#a14c3e', marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error?.message}
              </pre>
            </details>
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
