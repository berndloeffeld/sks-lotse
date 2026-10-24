import type { ReactNode } from 'react'

// Building blocks of the banded page layout (after a website template):
// full-width color bands, each holding a centered content column, with
// three-column text blocks that stack on mobile.

export const BAND_CONTENT = 'mx-auto w-full max-w-4xl px-4'

const TONE = {
  light: '',
  primary: 'bg-primary text-surface',
  dark: 'bg-primary-dark text-surface',
}

interface BandProps {
  tone?: keyof typeof TONE
  className?: string
  children: ReactNode
}

export function Band({ tone = 'light', className = 'py-16', children }: BandProps) {
  return (
    <section className={`${TONE[tone]} ${className}`}>
      <div className={BAND_CONTENT}>{children}</div>
    </section>
  )
}

export function Columns({ children, className = 'sm:grid-cols-3' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-10 sm:gap-8 ${className}`}>{children}</div>
}
