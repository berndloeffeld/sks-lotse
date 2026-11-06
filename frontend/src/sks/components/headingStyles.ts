// The two heading looks of the app's pages (ADR-0014, addendum 2026-10-08): the look follows the
// level, so sections of equal rank look alike from page to page.
// - sectionHeading: an h2, a section of the page (Gesamtfortschritt, Alle Fragen dieses Themas);
// - subsectionHeading: an h3, a part of such a section.
// Not for the landing page (its bands have their own scale), the page title (PageLayout's h1),
// dialog titles, or text that is a heading only for the outline (the question in PracticeRun).
export const sectionHeading = 'font-serif text-2xl text-primary'

export const subsectionHeading = 'font-serif text-xl text-ink'
