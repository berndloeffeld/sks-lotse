// Shared style for text links/buttons sitting on the header's dark band. Padding is symmetric
// (py-1, not just pb-1) so the text sits centered in its own box — next to HEADER_CTA's taller
// button box, `items-center` on the nav then lines up both texts instead of the button's
// vertically-centered text sitting lower than a link's bottom-padded-only text.
export const HEADER_LINK =
  'border-b-2 border-transparent py-1 font-mono text-xs tracking-wide text-surface-alt uppercase hover:border-surface hover:text-surface'

// A bordered pill button for the header's one real call to action ("Anmelden") — the same
// outline-button pattern as the hero's CTA (LandingPage's HERO_CTA), scaled down to sit inline
// in the nav, so it doesn't read as just another text link next to FAQ/Ablauf/Preise.
export const HEADER_CTA =
  'rounded-tile border-2 border-surface px-4 py-2 font-mono text-xs tracking-wide text-surface uppercase transition hover:bg-surface hover:text-primary-dark'
