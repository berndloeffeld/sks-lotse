// The icons of the account UI both sites share (the token counter, the Konto menu, the AGB
// welcome). Same stroke style as SKS Lotse's FeatureIcons.

interface IconProps {
  className?: string
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// A ship's wheel: a ring with eight short spokes — the Lotsen-Check (AI answer check) button, and
// the token balance in the header (the tokens pay for Lotsen-Checks).
export function HelmIcon({ className }: IconProps) {
  return (
    <svg {...stroke} viewBox="0 0 24 24" strokeWidth={1.7} className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" />
    </svg>
  )
}

// A head and shoulders — the learner's own account (the tab bar's Konto menu).
export function AccountIcon({ className }: IconProps) {
  return (
    <svg {...stroke} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="11" r="5" />
      <path d="M6 27c1.5-5 5.5-8 10-8s8.5 3 10 8" />
    </svg>
  )
}
