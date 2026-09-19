"""The "gelernt" streak rule: how a grading outcome moves a question's streak.

See docs/adr/0018-learning-progress-model-and-gelernt-streak-rule.md and
docs/adr/0023-self-assessed-learning-flow.md.
"""

from typing import Literal

LEARNED_STREAK_THRESHOLD = 3

# The three outcomes of the self-assessment control (ADR-0014), in the
# order the UI lists them.
GradingOutcome = Literal["richtig", "teilweise_richtig", "falsch"]


def is_learned(correct_streak: int) -> bool:
    return correct_streak >= LEARNED_STREAK_THRESHOLD


def next_streak(correct_streak: int, outcome: GradingOutcome) -> int:
    # Only a full "Richtig" extends the streak; anything else resets it —
    # it's a consecutive run, not a cumulative count.
    return correct_streak + 1 if outcome == "richtig" else 0
