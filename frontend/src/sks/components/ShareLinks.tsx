import type { ReactNode } from 'react'

import { SHARE_TITLE, SHARE_URL } from '../share'

const ICON_SIZE = 32

const url = encodeURIComponent(SHARE_URL)
const title = encodeURIComponent(SHARE_TITLE)

// Each network's own share dialog, as a plain link in a new tab: no script, no third-party widget.
const TARGETS: { label: string; href: string; background: string; glyph: ReactNode; external: boolean }[] = [
  {
    label: 'Auf WhatsApp teilen',
    href: `https://api.whatsapp.com/send?text=${title}%20${url}`,
    background: '#25D366',
    glyph: <path d="M12 5a7 7 0 0 0-6 10.6L5 19l3.5-.9A7 7 0 1 0 12 5z" fill="none" stroke="#fff" strokeWidth="1.8" />,
    external: true,
  },
  {
    label: 'Auf Facebook teilen',
    href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    background: '#0866FF',
    glyph: (
      <path
        d="M13.5 21v-7.5H16l.5-3h-3V8.7c0-.9.3-1.5 1.6-1.5h1.4V4.5c-.3 0-1.1-.2-2.1-.2-2.2 0-3.8 1.3-3.8 3.8v2.4H8v3h2.5V21z"
        fill="#fff"
      />
    ),
    external: true,
  },
  {
    label: 'Auf Telegram teilen',
    href: `https://telegram.me/share/url?url=${url}&text=${title}`,
    background: '#229ED9',
    glyph: <path d="M5 11.5 18.5 6l-2.4 12-4.1-3-2.4 2.3-.4-3.6z" fill="#fff" />,
    external: true,
  },
  {
    label: 'Per E-Mail teilen',
    href: `mailto:?subject=${title}&body=${url}`,
    background: '#7F7F7F',
    glyph: <path d="M5 7h14v10H5zM5 7l7 5.5L19 7" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />,
    external: false,
  },
]

export function ShareLinks() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-xs tracking-wide text-surface-alt uppercase">Sag&apos;s weiter</span>
      <div className="flex items-center gap-3">
        {TARGETS.map(({ label, href, background, glyph, external }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="12" fill={background} />
              {glyph}
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}
