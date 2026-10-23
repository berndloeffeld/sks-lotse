// The one contact address (also in Impressum/Datenschutz). Feedback goes there
// by plain mail — no form, no extra personal data stored.
export const CONTACT_EMAIL = 'kontakt@sks-lotse.de'
// One address for both brands (ADR-0067); the subject says which site the mail came from.
export function feedbackMailto(brand: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Feedback ${brand}`)}`
}
export const FEEDBACK_MAILTO = feedbackMailto('SKS Lotse')
