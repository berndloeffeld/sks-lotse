import {
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  TelegramIcon,
  TelegramShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from 'react-share'

import { SHARE_TITLE, SHARE_URL } from '../share'

const ICON_SIZE = 32

// react-share draws the brand icons and opens each network's own share
// dialog in a popup — no hand-rolled share-URL building needed.
export function ShareLinks() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-xs tracking-wide text-surface-alt uppercase">SKS Lotse weitersagen</span>
      <div className="flex items-center gap-3">
        <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE} aria-label="Auf WhatsApp teilen">
          <WhatsappIcon size={ICON_SIZE} round />
        </WhatsappShareButton>
        <FacebookShareButton url={SHARE_URL} aria-label="Auf Facebook teilen">
          <FacebookIcon size={ICON_SIZE} round />
        </FacebookShareButton>
        <TelegramShareButton url={SHARE_URL} title={SHARE_TITLE} aria-label="Auf Telegram teilen">
          <TelegramIcon size={ICON_SIZE} round />
        </TelegramShareButton>
        <EmailShareButton url={SHARE_URL} subject={SHARE_TITLE} aria-label="Per E-Mail teilen">
          <EmailIcon size={ICON_SIZE} round />
        </EmailShareButton>
      </div>
    </div>
  )
}
