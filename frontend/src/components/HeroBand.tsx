import type { ReactNode } from 'react'

import { ContourBackground } from './ContourBackground'

interface HeroBandProps {
  children: ReactNode
  // Vertical padding; the bottom needs room for the slanted edge.
  className?: string
}

// The primary-colored band under the header, with contour lines and a
// slanted bottom edge like a horizon line — used for the landing page's
// hero and every other page's title.
export function HeroBand({ children, className = 'pt-10 pb-20' }: HeroBandProps) {
  return (
    <section
      className={`relative bg-primary text-surface ${className}`}
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)' }}
    >
      <ContourBackground className="h-full" stroke="var(--color-surface-alt)" />
      <div className="relative">{children}</div>
    </section>
  )
}
