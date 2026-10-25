"""Vetted question bank for adaptive interview fallback.

Questions are organized by category and difficulty (1=easy, 2=medium, 3=hard).
Each question includes the context it builds on (fact provenance hint) so the
interviewer can reference prior conversation when asking follow-ups.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class BankQuestion:
    text: str
    category: str  # "intro" | "resume" | "jd_technical" | "jd_behavioral" | "general"
    difficulty: int  # 1=easy, 2=medium, 3=hard
    builds_on: Optional[str] = None  # provenance hint: "resume", "jd", "candidate-said"
    follow_up_of: Optional[str] = None  # which prior question this follows


# ── Fixed opener ──────────────────────────────────────────────────────────
OPENER = BankQuestion(
    text="Tell me about yourself.",
    category="intro",
    difficulty=1,
    builds_on=None,
)

# ── Resume / project deep-dives ───────────────────────────────────────────
RESUME_QUESTIONS = [
    BankQuestion(
        text="Walk me through a project you're most proud of from your resume.",
        category="resume",
        difficulty=2,
        builds_on="resume",
    ),
    BankQuestion(
        text="What was your specific role in that project, and what technologies did you use?",
        category="resume",
        difficulty=2,
        builds_on="resume",
        follow_up_of="Walk me through a project you're most proud of from your resume.",
    ),
    BankQuestion(
        text="What was the biggest technical challenge you faced in that project, and how did you resolve it?",
        category="resume",
        difficulty=3,
        builds_on="resume",
        follow_up_of="What was your specific role in that project, and what technologies did you use?",
    ),
    BankQuestion(
        text="If you could rebuild that project today, what would you do differently?",
        category="resume",
        difficulty=3,
        builds_on="resume",
    ),
    BankQuestion(
        text="What was the most important technical decision you made in that project?",
        category="resume",
        difficulty=2,
        builds_on="resume",
    ),
    BankQuestion(
        text="How did you collaborate with other team members on that project?",
        category="resume",
        difficulty=2,
        builds_on="resume",
    ),
]

# ── JD-specific technical questions ───────────────────────────────────────
JD_TECHNICAL = [
    BankQuestion(
        text="What experience do you have with the core technologies required for this role?",
        category="jd_technical",
        difficulty=2,
        builds_on="jd",
    ),
    BankQuestion(
        text="Describe a time you had to debug a production issue. What was your approach?",
        category="jd_technical",
        difficulty=3,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="How do you ensure code quality and maintainability in your work?",
        category="jd_technical",
        difficulty=2,
        builds_on="resume",
    ),
]

# ── JD-specific behavioral questions ──────────────────────────────────────
JD_BEHAVIORAL = [
    BankQuestion(
        text="Tell me about a time you had to learn a new technology quickly for a project.",
        category="jd_behavioral",
        difficulty=2,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="Describe a situation where you disagreed with a teammate. How did you resolve it?",
        category="jd_behavioral",
        difficulty=3,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="How do you prioritize tasks when working on multiple projects with tight deadlines?",
        category="jd_behavioral",
        difficulty=2,
        builds_on="resume",
    ),
]

# ── General follow-ups ────────────────────────────────────────────────────
GENERAL_FOLLOW_UPS = [
    BankQuestion(
        text="Can you give me a specific example to illustrate that point?",
        category="general",
        difficulty=2,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="What was the outcome, and how did you measure success?",
        category="general",
        difficulty=2,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="Looking back, what would you have done differently?",
        category="general",
        difficulty=3,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="Can you walk me through your thought process on that?",
        category="general",
        difficulty=2,
        builds_on="candidate-said",
    ),
    BankQuestion(
        text="What would you consider the key takeaway from that experience?",
        category="general",
        difficulty=2,
        builds_on="candidate-said",
    ),
]


def get_opener() -> BankQuestion:
    """Return the fixed opening question."""
    return OPENER


def get_bank_question(
    category: str,
    difficulty: int,
    exclude: set[str],
    builds_on: Optional[str] = None,
) -> Optional[BankQuestion]:
    """Return a non-duplicate bank question matching category and difficulty.

    `exclude` contains normalized text of questions already asked.
    """
    pool: list[BankQuestion]
    if category == "intro":
        pool = [OPENER]
    elif category == "resume":
        pool = RESUME_QUESTIONS
    elif category == "jd_technical":
        pool = JD_TECHNICAL
    elif category == "jd_behavioral":
        pool = JD_BEHAVIORAL
    elif category == "general":
        pool = GENERAL_FOLLOW_UPS
    else:
        pool = GENERAL_FOLLOW_UPS

    candidates = [
        q
        for q in pool
        if q.difficulty == difficulty
        and _normalize(q.text) not in exclude
        and (builds_on is None or q.builds_on == builds_on or q.builds_on is None)
    ]
    if not candidates:
        # Fall back to any difficulty in the same category
        candidates = [
            q
            for q in pool
            if _normalize(q.text) not in exclude
            and (builds_on is None or q.builds_on == builds_on or q.builds_on is None)
        ]
    if not candidates:
        return None
    return candidates[0]


def _normalize(text: str) -> str:
    return " ".join(
        "".join(char.lower() if char.isalnum() else " " for char in text).split()
    )
