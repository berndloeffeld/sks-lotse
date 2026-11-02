interface ContourBackgroundProps {
  className?: string
  // Line color; override for colored bands (e.g. the landing page hero).
  stroke?: string
}

// The "faint bathymetric contour-line texture" from ADR-0014's concept
// section — decorative only, sits behind a page's top/header area. The
// element it sits behind must itself be a positioned element (e.g. a
// `relative` wrapper) to paint above this absolutely-positioned svg,
// since CSS otherwise paints positioned elements above static ones
// regardless of DOM order.
export function ContourBackground({ className, stroke = 'var(--color-border)' }: ContourBackgroundProps) {
  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-x-0 top-0 w-full ${className ?? 'h-56'}`}
    >
      <path
        d="M-50,60 C150,10 350,100 600,55 C850,10 1000,90 1250,45"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.6"
      />
      <path
        d="M-50,130 C150,80 350,170 600,120 C850,70 1000,155 1250,110"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.45"
      />
      <path
        d="M-50,200 C150,150 350,235 600,185 C850,135 1000,220 1250,175"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.3"
      />
      <path
        d="M-50,270 C150,225 350,300 600,255 C850,210 1000,285 1250,245"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.2"
      />
    </svg>
  )
}
