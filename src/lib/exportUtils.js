/**
 * Shared CSV export utility.
 * Converts an array of objects to a CSV string and triggers a browser download.
 */
export function downloadCsv(rows, filename = 'export.csv') {
  if (!rows || rows.length === 0) return

  const escapeCell = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Triggers a browser PDF print for a given HTML element by ID.
 * Opens print preview with only that element visible.
 */
export function printElementAsPdf(elementId, title = 'PerDevSys Report') {
  const el = document.getElementById(elementId)
  if (!el) return

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; }
        body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #1a1a2e; padding: 32px; }
        h1, h2, h3 { color: #2e2b5f; margin-bottom: 8px; }
        p, li { line-height: 1.6; font-size: 13px; color: #444; }
        ul { padding-left: 18px; margin: 8px 0; }
        .report-section { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e5f0; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #6a5acd; }
        .report-header h1 { font-size: 22px; }
        .report-header small { font-size: 11px; color: #888; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="report-header">
        <h1>${title}</h1>
        <small>Generated: ${new Date().toLocaleString()}<br/>PerDevSys — Personnel Development System</small>
      </div>
      ${el.innerHTML}
    </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => { printWindow.print() }, 500)
}
