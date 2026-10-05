// Only the display label lives here. Which AGB version is in force, and whether an account
// still owes the confirmation (UserRead.needs_agb_acceptance), is decided by the backend
// (backend/app/domain/legal.py's CURRENT_AGB_VERSION): bump that together with this label
// whenever the AGB text changes materially; AgbPage.tsx shows the label.
export const AGB_VERSION_LABEL = '5. Oktober 2026'
