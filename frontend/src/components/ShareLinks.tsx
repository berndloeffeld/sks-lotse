import { SHARE_MAILTO, TWITTER_SHARE_URL, WHATSAPP_SHARE_URL } from '../share'

const LINK_CLASS = 'border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface'

// Plain share-intent links, no third-party button script — the page just
// needed *some* social-sharing option, not a full share-button pipeline.
export function ShareLinks() {
  return (
    <nav
      aria-label="Seite teilen"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-xs tracking-wide uppercase"
    >
      <span>SKS Lotse weitersagen:</span>
      <a href={WHATSAPP_SHARE_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        WhatsApp
      </a>
      <a href={TWITTER_SHARE_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        X
      </a>
      <a href={SHARE_MAILTO} className={LINK_CLASS}>
        E-Mail
      </a>
    </nav>
  )
}
