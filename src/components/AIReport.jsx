import { Fragment } from 'react'

const blocks = content => content.split(/\n\s*\n/).filter(Boolean)

// Render inline Markdown: **bold** -> <strong>, plus fallback for `#text#` style bold.
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|#[^#\n]+#)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('#') && part.endsWith('#') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1)}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

// Render a block of lines, grouping consecutive `- ` / `* ` lines into a list.
function renderContent(content, keyPrefix) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const elements = []
  let listItems = []

  const flushList = key => {
    if (listItems.length) {
      elements.push(
        <ul key={key}>
          {listItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
        </ul>,
      )
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const match = line.match(/^[-*]\s+(.*)$/)
    if (match) {
      listItems.push(match[1])
    } else {
      flushList(`${keyPrefix}-ul-${index}`)
      elements.push(<p key={`${keyPrefix}-p-${index}`}>{renderInline(line)}</p>)
    }
  })
  flushList(`${keyPrefix}-ul-end`)

  return elements
}

export default function AIReport({ insights = [], content = '', title = '' }) {
  const source = content?.trim() || insights?.map(insight => insight.summary).join('\n\n') || ''
  const reportTitle = title || ''
  return <article className="ai-report" aria-label="AI analytics report">
    {reportTitle && <header className="ai-report-header"><h2>{reportTitle}</h2></header>}
    {source ? blocks(source).map((block, blockIndex) => {
      const key = `r-${blockIndex}`
      if (block.startsWith('# ') && !reportTitle) return <h2 key={key}>{block.slice(2).trim()}</h2>
      if (block.startsWith('## ')) {
        const [heading, ...rest] = block.slice(3).split('\n')
        const body = rest.join('\n').trim()
        return (
          <section key={key} className={`ai-report-section${/recommend/i.test(heading) ? ' ai-report-recommend' : ''}`}>
            <h3>{heading.trim()}</h3>
            {body ? renderContent(body, `${key}-body`) : <p>Insufficient records exist for this section.</p>}
          </section>
        )
      }
      return renderContent(block, `${key}-body`)
    }) : <div className="insight-empty"><b>No report available</b><p>Generate a report to view structured AI analytics.</p></div>}
  </article>
}
