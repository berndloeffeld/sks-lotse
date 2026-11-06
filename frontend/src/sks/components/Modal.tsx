import { useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useModalFocus } from '../hooks/useModalFocus'

const PLACEMENT = {
  // A dialog in the middle of the screen (the AGB confirmation).
  center: {
    overlay: 'items-center justify-center bg-ink/60 p-4',
    panel: 'flex w-full max-w-md flex-col gap-4 rounded-tile border border-ink bg-surface p-6 shadow-xl',
  },
  // A sheet sliding up from the bottom edge (the chart tools on a phone).
  sheet: {
    overlay: 'flex-col justify-end bg-ink/40',
    panel: 'flex max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-t-tile bg-surface p-4',
  },
}

type Labelled = { label: string; labelledBy?: never } | { labelledBy: string; label?: never }

// A modal dialog over the page: rendered outside the app (a portal), which stays inert behind it
// while it is open; focus handling in useModalFocus. With `onClose`, Escape and a click on the
// dimmed backdrop close it; without (a mandatory step), only its own buttons can.
export function Modal({
  onClose,
  initialFocusRef,
  placement = 'center',
  describedBy,
  className = '',
  children,
  ...labelled
}: Labelled & {
  onClose?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  placement?: keyof typeof PLACEMENT
  describedBy?: string
  className?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(panelRef, { onClose, initialFocusRef })
  const styles = PLACEMENT[placement]

  return createPortal(
    // The backdrop is only a pointer shortcut; Escape and the dialog's own close button are its
    // keyboard equivalents.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- see above
    <div
      data-testid="modal-backdrop"
      className={`fixed inset-0 z-(--z-modal) flex ${styles.overlay}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelled.label}
        aria-labelledby={labelled.labelledBy}
        aria-describedby={describedBy}
        className={`${styles.panel} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
