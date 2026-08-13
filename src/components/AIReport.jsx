import { Fragment } from 'react'

// Preprocessor to clean glued markdown headings and normalize block spacing
function cleanMarkdown(text = '') {
  if (!text) return ''
  return text
    // Normalize any glued headings onto newlines: e.g. "# Attendance Analysis" or "## Attendance Analysis"
    .replace(/(^|[^\n])\s*(#{1,3})\s*/g, '$1\n\n$2 ')
    // Normalize inline bold list items "1. **Title**:"
    .replace(/(\s+)(\d+\.\s+\*\*)/g, '\n$2')
    .trim()
}

// Render inline Markdown: **bold** -> <strong>, plus fallback for `#text#` or `##text##` style bold.
function renderInline(text) {
  if (!text) return null
  // Strip any accidental leading/trailing stray # or ## symbols from inline title text
  const cleanStr = text.replace(/^#{1,3}\s*/, '').replace(/\s*#{1,3}$/, '')
  const parts = cleanStr.split(/(\*\*[^*]+\*\*|##[^#\n]+##|#[^#\n]+#)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('##') && part.endsWith('##') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2).trim()}</strong>
    }
    if (part.startsWith('#') && part.endsWith('#') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1).trim()}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

// Render a block of lines, grouping consecutive `- ` / `* ` / `1. ` lines into a list.
function renderContent(content, keyPrefix) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const elements = []
  let listItems = []
  let isNumbered = false

  const flushList = key => {
    if (listItems.length) {
      if (isNumbered) {
        elements.push(
          <ol key={key} style={{ paddingLeft: 18, margin: '5px 0', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            {listItems.map((item, index) => <li key={index} style={{ marginBottom: 3 }}>{renderInline(item)}</li>)}
          </ol>,
        )
      } else {
        elements.push(
          <ul key={key} style={{ paddingLeft: 18, margin: '5px 0', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            {listItems.map((item, index) => <li key={index} style={{ marginBottom: 3 }}>{renderInline(item)}</li>)}
          </ul>,
        )
      }
      listItems = []
      isNumbered = false
    }
  }

  lines.forEach((line, index) => {
    // Strip accidental leading '#' from body lines
    const sanitized = line.replace(/^#{1,3}\s*/, '')
    if (!sanitized || /^#{1,3}$/.test(sanitized)) return

    const bulletMatch = sanitized.match(/^[-*]\s+(.*)$/)
    const numMatch = sanitized.match(/^(\d+)\.\s+(.*)$/)
    if (bulletMatch) {
      if (isNumbered) flushList(`${keyPrefix}-list-${index}`)
      listItems.push(bulletMatch[1])
    } else if (numMatch) {
      if (!isNumbered && listItems.length) flushList(`${keyPrefix}-list-${index}`)
      isNumbered = true
      listItems.push(numMatch[2])
    } else {
      flushList(`${keyPrefix}-list-${index}`)
      elements.push(<p key={`${keyPrefix}-p-${index}`} style={{ margin: '4px 0', lineHeight: 1.6, color: '#374151', fontSize: 12 }}>{renderInline(sanitized)}</p>)
    }
  })
  flushList(`${keyPrefix}-list-end`)

  return elements
}

export default function AIReport({ insights = [], content = '', title = '' }) {
  const source = content?.trim() || insights?.map(insight => insight.summary).join('\n\n') || ''
  const reportTitle = title || ''
  const rawBlocks = cleanMarkdown(source).split(/\n\s*\n/).filter(Boolean)

  return (
    <article className="ai-report" aria-label="AI analytics report" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reportTitle && (
        <header className="ai-report-header" style={{ borderBottom: '1px solid #eeedf2', paddingBottom: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{reportTitle}</h2>
        </header>
      )}

      {rawBlocks.length > 0 ? (
        rawBlocks.map((block, blockIndex) => {
          const trimmed = block.trim()
          const key = `b-${blockIndex}`

          // Ignore standalone '#' or '##' artifacts
          if (/^#{1,3}$/.test(trimmed)) return null

          // Check if block is a heading: starts with '#', '##', or '###'
          const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/s)
          if (headingMatch) {
            const rawTitle = headingMatch[2].trim()
            const [firstLine, ...bodyLines] = rawTitle.split('\n')
            const cleanTitle = firstLine.replace(/#{1,3}$/, '').trim()
            const bodyText = bodyLines.join('\n').trim()

            // Skip if cleanTitle is empty or matches reportTitle
            if (!cleanTitle || cleanTitle === reportTitle) {
              return bodyText ? renderContent(bodyText, key) : null
            }

            return (
              <section key={key} className="ai-report-section" style={{ marginTop: 6 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#5f48c5', margin: '0 0 4px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {renderInline(cleanTitle)}
                </h3>
                {bodyText ? renderContent(bodyText, `${key}-body`) : null}
              </section>
            )
          }

          return renderContent(trimmed, key)
        })
      ) : (
        <div className="insight-empty">
          <b>No report available</b>
          <p>Generate a report to view structured AI analytics.</p>
        </div>
      )}
    </article>
  )
}
