"""Single source of truth for the AGB version currently in force.

Keep in sync with frontend/src/legal.ts's AGB_VERSION and AgbPage.tsx's
"Stand:"-date. Bumping this makes every account whose stored
agb_accepted_version differs see the AGB-Gate again on next login
(frontend/src/routes/AgbGate.tsx).
"""

CURRENT_AGB_VERSION = "2026-09-23"
