"""Single source of truth for the AGB version currently in force.

Keep in sync with frontend/src/legal.ts's AGB_VERSION_LABEL (the "Stand:"
date AgbPage.tsx shows). Bumping this makes every account whose stored
agb_accepted_version differs see the AGB-Gate again on next login: the API
reports it as UserRead.needs_agb_acceptance (frontend/src/routes/AgbGate.tsx).
"""

CURRENT_AGB_VERSION = "2026-10-02"
