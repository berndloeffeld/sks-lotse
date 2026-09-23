// Plain share-intent links for the landing page — no share-button library
// needed for three static links (also in ShareLinks, tested there).
const SHARE_URL = 'https://sks-lotse.de'
const SHARE_TEXT = 'SKS Lotse – online für die SKS-Theorieprüfung lernen'

export const WHATSAPP_SHARE_URL = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`
export const TWITTER_SHARE_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`
export const SHARE_MAILTO = `mailto:?subject=${encodeURIComponent(SHARE_TEXT)}&body=${encodeURIComponent(SHARE_URL)}`
