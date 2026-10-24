import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// A picture at full size over the page, for reading the small print of a PDF cut. A click beside the
// picture, the cross or Escape closes it. Not a Modal: it is also opened from the phone's tool sheet,
// which is a Modal itself, and Escape must close only this one (a capturing listener on window runs
// before the sheet's own, and swallows the key).
export function ImageLightbox({
  src,
  width,
  height,
  alt,
  onClose,
}: {
  src: string
  width: number
  height: number
  alt: string
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onCloseRef.current()
      } else if (event.key === 'Tab') {
        event.preventDefault() // the cross is the only stop
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  return createPortal(
    // The backdrop is only a pointer shortcut; Escape and the cross are its keyboard equivalents.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- see above
    <div
      data-testid="lightbox-backdrop"
      className="fixed inset-0 z-(--z-modal) flex items-start justify-center overflow-auto bg-ink/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={alt} className="relative my-auto">
        <button
          ref={closeRef}
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full border border-ink bg-surface text-xl leading-none text-ink"
        >
          <span aria-hidden="true">×</span>
        </button>
        <img
          src={src}
          width={width}
          height={height}
          alt={alt}
          // Full resolution, never wider than the screen.
          style={{ maxWidth: width }}
          className="h-auto w-full rounded-tile bg-surface"
        />
      </div>
    </div>,
    document.body,
  )
}
