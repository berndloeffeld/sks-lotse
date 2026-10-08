import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

// Wraps Tab and Shift+Tab around the panel's ends, so focus never leaves it for the page behind.
function trapTab(event: KeyboardEvent, panel: HTMLElement) {
  const stops = focusables(panel)
  if (stops.length === 0) {
    event.preventDefault()
    return
  }
  const first = stops[0]
  const last = stops[stops.length - 1]
  const active = document.activeElement
  const outside = !panel.contains(active)
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

// The keyboard and screen-reader side of a modal dialog (Modal.tsx), for as long as the calling
// component is mounted:
// - the app behind it (#root) is inert and doesn't scroll, so neither a click, Tab nor a screen
//   reader's virtual cursor reaches it;
// - focus starts on `initialFocusRef` (else the panel's first focusable element) and Tab cycles
//   inside the panel;
// - Escape calls `onClose`; without one (a mandatory dialog such as the AGB) Escape does nothing;
// - on unmount the page is live again and focus returns to where it was before.
// The panel itself must sit outside #root (a portal), or it would be inert too.
export function useModalFocus(
  panelRef: RefObject<HTMLElement | null>,
  { onClose, initialFocusRef }: { onClose?: () => void; initialFocusRef?: RefObject<HTMLElement | null> } = {},
) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const app = document.getElementById('root')
    app?.setAttribute('inert', '')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const start = initialFocusRef?.current ?? (panel ? focusables(panel)[0] : undefined)
    start?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault()
        onCloseRef.current()
      } else if (event.key === 'Tab' && panelRef.current) {
        trapTab(event, panelRef.current)
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      app?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
    // Set up once per opening: the refs are stable, and onClose is read through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [])
}
