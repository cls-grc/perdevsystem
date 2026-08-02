import { useEffect, useRef } from 'react'

/**
 * useDialogFocus — keyboard-accessible modal dialog management.
 *
 * Features:
 *  - Focus trap: Tab/Shift+Tab cycle is confined to the dialog content.
 *  - Escape-to-close: pressing Escape invokes onClose (and refocuses opener).
 *  - Focus restore: on open, focuses the first focusable element; on close,
 *    returns focus to the element that opened the dialog.
 *  - Background scroll lock while open.
 *
 * @param {boolean} open       Whether the dialog is open.
 * @param {() => void} onClose Called when Escape is pressed.
 * @param {{ focusFirstOnOpen?: boolean }} options
 */
export default function useDialogFocus(open, onClose, { focusFirstOnOpen = true } = {}) {
  const containerRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const container = containerRef.current
    if (!container) return undefined

    // Remember what had focus before the dialog opened.
    previouslyFocusedRef.current = document.activeElement

    // Focus the first focusable element inside the dialog (or the container itself).
    if (focusFirstOnOpen) {
      const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      if (first) {
        first.focus()
      } else {
        container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    // Lock background scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      // Escape closes the dialog.
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }

      // Tab focus trap.
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      if (!focusable.length) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last.
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        // Tab: if on last element, wrap to first.
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      // Restore focus to the opener once closed.
      const previouslyFocused = previouslyFocusedRef.current
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open, onClose, focusFirstOnOpen])

  return containerRef
}

