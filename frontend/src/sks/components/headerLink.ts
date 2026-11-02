// Shared style for text links/buttons sitting on the header's dark band. The header rows align
// their items on the text baseline (`items-baseline`), so a link's text lines up with the
// wordmark and with the bordered buttons' text whatever their padding.
export const HEADER_LINK =
  'border-b-2 border-transparent py-1 font-mono text-xs tracking-wide text-surface-alt uppercase hover:border-surface hover:text-surface'

// HEADER_LINK for the page the learner is on (NavLink's active state): underlined, full contrast.
export const HEADER_LINK_ACTIVE =
  'border-b-2 border-surface py-1 font-mono text-xs tracking-wide text-surface uppercase'

// A bordered pill button for the header's one real call to action ("Anmelden") — the same
// outline-button pattern as the hero's CTA (LandingPage's HERO_CTA), scaled down to sit inline
// in the nav, so it doesn't read as just another text link next to Prüfungsablauf/Preise/FAQ.
export const HEADER_CTA =
  'rounded-tile border-2 border-surface px-4 py-2 font-mono text-xs tracking-wide text-surface uppercase transition hover:bg-surface hover:text-primary-dark'

// The logged-in header's "Menü" button (AccountMenu): HEADER_CTA's outline, so it stands out
// from the plain links next to it, with room for the chevron.
export const HEADER_MENU_BUTTON =
  'inline-flex items-baseline gap-1.5 rounded-tile border-2 border-surface px-3 py-2 font-mono text-xs tracking-wide text-surface uppercase transition hover:bg-surface hover:text-primary-dark'

// A tab of the phone tab bar (MobileTabBar, and the Konto menu's button in it): icon over label,
// sharing the bar's width with the others. The current area is in primary, the rest muted.
export function tabBarItemClass(isActive: boolean): string {
  return `flex flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-2xs ${
    isActive ? 'text-primary' : 'text-ink-soft hover:text-primary'
  }`
}
