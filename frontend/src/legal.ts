// Single source of truth for the AGB version currently in force — bump this
// and AGB_VERSION_LABEL (and backend/app/core/legal.py's CURRENT_AGB_VERSION)
// whenever the AGB text changes materially; AgbPage.tsx shows the label.
// Every account whose stored agb_accepted_version differs sees the AGB-Gate
// again on next login (see routes/AgbGate.tsx).
export const AGB_VERSION = '2026-09-25'
export const AGB_VERSION_LABEL = '25. September 2026'
