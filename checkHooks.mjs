import fs from 'fs'
import path from 'path'

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  const lines = code.split('\n')

  let hasReturned = false
  let functionName = ''
  let lineNum = 0

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('export default function') || trimmed.startsWith('function ') || trimmed.match(/const \w+ = \([^)]*\) =>/)) {
      hasReturned = false
      functionName = trimmed
    }

    if (trimmed.match(/^if\s*\(.*\)\s*return\s/) && !trimmed.includes('useCallback') && !trimmed.includes('useMemo')) {
      hasReturned = true
    }

    if (hasReturned && trimmed.match(/\b(useState|useEffect|useMemo|useCallback|useRef|useContext|useLayoutEffect|useDialogFocus)\b/)) {
      console.log(`⚠️ HOOK AFTER RETURN in ${filePath}:${index + 1}`)
      console.log(`   Line ${index + 1}: ${trimmed}`)
    }
  })
}

function walkDir(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walkDir(full)
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      checkFile(full)
    }
  }
}

console.log('Checking for hooks after return statements...')
walkDir('./src')
console.log('Done checking.')
