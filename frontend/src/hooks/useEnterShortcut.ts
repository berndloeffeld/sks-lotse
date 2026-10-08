import { useSyncExternalStore, type KeyboardEvent } from 'react'

// A mouse or trackpad: the device most likely has a real keyboard, with Shift+Enter for a line
// break. Phones and tablets report a coarse pointer and no hover.
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

function finePointerQuery(): MediaQueryList | undefined {
  return typeof window === 'undefined' ? undefined : window.matchMedia?.(FINE_POINTER)
}

// Safari before 14 only has the old addListener: there the answer just doesn't follow a change.
function subscribe(onChange: () => void) {
  const query = finePointerQuery()
  query?.addEventListener?.('change', onChange)
  return () => query?.removeEventListener?.('change', onChange)
}

// Without matchMedia (the prerender, jsdom) the shortcut stays on, as on a desktop.
function hasFinePointer() {
  return finePointerQuery()?.matches ?? true
}

// "Enter does it, Shift+Enter is a line break" for an answer field (the practice run, the exam,
// the Kartenaufgaben) — only where there is a keyboard to press Shift on. A touch keyboard has no
// Shift+Enter, so there Enter stays a line break and the field's hint about the shortcut is left
// out (`enabled`). An IME composition's Enter only confirms the composed word.
export function useEnterShortcut(action: (event: KeyboardEvent<HTMLTextAreaElement>) => void) {
  const enabled = useSyncExternalStore(subscribe, hasFinePointer, () => true)

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!enabled || event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    action(event)
  }

  return { enabled, onKeyDown }
}
