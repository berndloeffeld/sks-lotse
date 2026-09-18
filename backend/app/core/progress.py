"""How many consecutive "Richtig" gradings make a question "gelernt".

See docs/adr/0018-learning-progress-model-and-gelernt-streak-rule.md.
"""

LEARNED_STREAK_THRESHOLD = 3


def is_learned(correct_streak: int) -> bool:
    return correct_streak >= LEARNED_STREAK_THRESHOLD
