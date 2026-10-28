"""
Phase 4C: Interview Blueprint
Creates personalized interview plan by merging:
- Candidate profile (resume, skills, experience)
- Job requirements (JD, priority skills, gaps)
- Interview strategy (questioning areas, difficulty progression, evaluation criteria)

Output: InterviewBlueprint that orchestrator uses to conduct interview
"""

import json
import logging
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

logger = logging.getLogger(__name__)


class EvaluationCriterion(BaseModel):
    """One evaluation criterion for the interview"""

    name: str  # e.g., "Docker Knowledge", "System Design Thinking"
    category: str  # "technical" or "behavioral"
    importance_score: float = Field(..., ge=0, le=1)  # How important for this role
    priority_skill: Optional[str] = Field(None)  # Linked skill to verify
    evaluation_questions: List[str] = Field(default_factory=list)  # Questions to assess
    expected_responses: List[str] = Field(default_factory=list)  # What good answers look like


class InterviewBlueprint(BaseModel):
    """Personalized interview plan for a candidate-role pairing"""

    # IDs
    candidate_id: str
    job_id: str
    session_id: Optional[str] = Field(None, description="Interview session ID (if already created)")

    # Candidate context
    candidate_name: str
    candidate_experience_years: int
    candidate_skills: List[str]
    candidate_strengths: List[str] = Field(default_factory=list)

    # Role context
    target_role: str
    company: str
    role_experience_required: int
    role_seniority_level: str
    role_required_skills: List[str]
    role_preferred_skills: List[str] = Field(default_factory=list)

    # Match analysis
    overall_fit_score: Optional[float] = Field(None, ge=0, le=1)
    skill_gaps: List[str] = Field(default_factory=list)
    skill_strengths: List[str] = Field(default_factory=list)

    # Interview strategy
    estimated_difficulty_level: int = Field(..., ge=1, le=3)  # 1=easy, 2=medium, 3=hard
    interview_focus_areas: List[str] = Field(..., description="Top areas to probe")
    interview_pitfalls_to_check: List[str] = Field(default_factory=list)

    # Evaluation criteria
    evaluation_criteria: List[EvaluationCriterion] = Field(default_factory=list)

    # State machine config
    expected_state_sequence: List[str] = Field(
        default_factory=lambda: ["intro", "warmup", "technical", "behavioral", "pressure", "closing"],
        description="Planned interview states",
    )
    time_per_state_seconds: dict[str, int] = Field(
        default_factory=lambda: {
            "intro": 30,
            "warmup": 60,
            "technical": 180,
            "behavioral": 120,
            "pressure": 120,
            "closing": 60,
        },
        description="Target time per state",
    )

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expected_duration_seconds: int = Field(..., description="Total expected interview duration")
    resume_text: str = ""
    job_description_text: str = ""
    job_category: Optional[str] = None
    interview_type: str = "mixed"

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class BlueprintBuilder:
    """Build interview blueprint from candidate profile and job requirements"""

    def __init__(self):
        pass

    async def build_blueprint(
        self,
        candidate_id: str,
        candidate_name: str,
        parsed_resume,
        job_id: str,
        target_role: str,
        company: str,
        jd_match,
        job_description,
        difficulty: int = 2,
        duration_seconds: int = 1800,
        interview_type: str = "mixed",
        resume_text: str = "",
        job_category: Optional[str] = None,
    ) -> InterviewBlueprint:
        """
        Create personalized interview blueprint.

        Args:
            candidate_id: Candidate ID
            candidate_name: Candidate name
            parsed_resume: ParsedResume from ResumeParser
            job_id: Job ID
            target_role: Target role name
            company: Company name
            jd_match: JDMatch from JDMatcher
            job_description: JobDescription from JDMatcher

        Returns:
            InterviewBlueprint with complete interview strategy
        """

        try:
            # Infer difficulty level based on fit
            if jd_match.overall_fit_score is None:
                difficulty_level = difficulty
            elif jd_match.overall_fit_score > 0.85:
                difficulty_level = 1  # Easy - candidate well-prepared
            elif jd_match.overall_fit_score > 0.65:
                difficulty_level = 2  # Medium - standard interview
            else:
                difficulty_level = 3  # Hard - candidate needs to prove themselves

            # Build evaluation criteria
            evaluation_criteria = []

            # Technical criteria based on priority skills
            for skill in jd_match.priority_skills_to_verify[:5]:
                criterion = EvaluationCriterion(
                    name=f"{skill} Expertise",
                    category="technical",
                    importance_score=0.9,
                    priority_skill=skill,
                    evaluation_questions=[
                        f"Walk me through your experience with {skill}.",
                        f"When would you NOT use {skill}? What are the trade-offs?",
                        f"Describe a production issue you faced with {skill}. How did you solve it?",
                    ],
                    expected_responses=[
                        "Specific project examples",
                        "Trade-off awareness",
                        "Production experience",
                    ],
                )
                evaluation_criteria.append(criterion)

            # System design criterion (for mid/senior roles)
            if job_description.seniority_level in ["mid", "senior", "staff"]:
                evaluation_criteria.append(
                    EvaluationCriterion(
                        name="System Design Thinking",
                        category="technical",
                        importance_score=0.8,
                        evaluation_questions=[
                            "Design a system that handles 1M requests per second.",
                            "What's your scaling strategy? What breaks first?",
                            "How do you balance consistency, availability, and partition tolerance?",
                        ],
                        expected_responses=[
                            "Mentions databases, caching, load balancing",
                            "Discusses trade-offs explicitly",
                            "Aware of CAP theorem or similar concepts",
                        ],
                    )
                )

            # Behavioral criteria
            evaluation_criteria.append(
                EvaluationCriterion(
                    name="Learning & Growth Mindset",
                    category="behavioral",
                    importance_score=0.7,
                    evaluation_questions=[
                        "Tell me about a time you had to learn something new quickly.",
                        "Describe your biggest professional failure. What did you learn?",
                    ],
                    expected_responses=[
                        "Shows structured learning approach",
                        "Ownership and growth mindset",
                    ],
                )
            )

            # Build expected state sequence timing
            time_per_state = {
                "intro": 30,
                "warmup": 60,
                "technical": 240,  # Longer for technical
                "behavioral": 120,
                "pressure": 120,
                "closing": 60,
            }

            # Adjust technical time based on difficulty
            if difficulty_level == 1:
                time_per_state["technical"] = 180
            elif difficulty_level == 3:
                time_per_state["technical"] = 300

            total_duration = duration_seconds

            # Build blueprint
            blueprint = InterviewBlueprint(
                candidate_id=candidate_id,
                job_id=job_id,
                candidate_name=candidate_name,
                candidate_experience_years=parsed_resume.years_experience or 0,
                candidate_skills=parsed_resume.technical_skills,
                candidate_strengths=jd_match.strength_areas,
                target_role=target_role,
                company=company,
                role_experience_required=job_description.experience_required_years,
                role_seniority_level=job_description.seniority_level,
                role_required_skills=job_description.required_skills,
                role_preferred_skills=job_description.preferred_skills,
                overall_fit_score=jd_match.overall_fit_score,
                skill_gaps=jd_match.gap_areas,
                skill_strengths=jd_match.strength_areas,
                estimated_difficulty_level=difficulty_level,
                interview_focus_areas=jd_match.priority_skills_to_verify,
                interview_pitfalls_to_check=jd_match.gap_areas,
                evaluation_criteria=evaluation_criteria,
                time_per_state_seconds=time_per_state,
                expected_duration_seconds=total_duration,
                resume_text=resume_text,
                job_description_text=job_description.job_description_text,
                job_category=job_category,
                interview_type=interview_type,
            )

            fit_str = (
                f"{blueprint.overall_fit_score:.0%}"
                if blueprint.overall_fit_score is not None
                else "N/A"
            )
            logger.info(
                f"✅ Built interview blueprint for {candidate_name} "
                f"(fit={fit_str}, difficulty={difficulty_level})"
            )

            return blueprint

        except Exception as e:
            logger.error(f"❌ Failed to build blueprint: {e}")
            # Return minimal blueprint on error
            return InterviewBlueprint(
                candidate_id=candidate_id,
                job_id=job_id,
                candidate_name=candidate_name,
                candidate_experience_years=0,
                candidate_skills=[],
                target_role=target_role,
                company=company,
                role_experience_required=0,
                role_seniority_level="mid",
                role_required_skills=[],
                overall_fit_score=0.5,
                estimated_difficulty_level=2,
                interview_focus_areas=[],
                expected_duration_seconds=600,
            )

    def get_focus_areas(self, blueprint: InterviewBlueprint) -> List[str]:
        """Get top interview focus areas from blueprint"""
        return blueprint.interview_focus_areas[:5]

    def get_evaluation_rubric(self, blueprint: InterviewBlueprint) -> dict:
        """Get evaluation rubric from blueprint"""
        rubric = {}
        for criterion in blueprint.evaluation_criteria:
            rubric[criterion.name] = {
                "category": criterion.category,
                "importance": criterion.importance_score,
                "evaluation_questions": criterion.evaluation_questions,
                "expected_responses": criterion.expected_responses,
            }
        return rubric
