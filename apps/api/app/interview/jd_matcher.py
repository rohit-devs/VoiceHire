"""
Phase 4B: Job Description Matching & RAG (Retrieval Augmented Generation)
Matches resume skills against job requirements using embeddings + semantic search.

Uses OpenAI embeddings to:
1. Embed all resume skills
2. Embed all JD requirements
3. Find semantic matches and gaps
4. Generate tailored interview questions based on JD priority skills
"""

import json
import logging
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
import numpy as np

from app.providers import ChatMessage, DemoProvider, GroqProvider, ProviderError

logger = logging.getLogger(__name__)


class JobDescription(BaseModel):
    """Job description with extracted requirements"""

    job_id: str
    job_title: str
    company: str
    experience_required_years: int = Field(..., ge=0, description="Years of experience required")
    seniority_level: str = Field(..., description="junior/mid/senior/staff")

    # Requirements extracted from JD
    required_skills: List[str] = Field(..., description="Required technical skills")
    preferred_skills: List[str] = Field(default_factory=list, description="Nice-to-have skills")
    nice_to_have: List[str] = Field(default_factory=list, description="Other nice-to-have qualities")

    # Metadata
    job_description_text: str = Field(..., description="Full JD text")
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class SkillMatch(BaseModel):
    """Individual skill match between resume and JD"""

    skill: str
    match_type: str = Field(..., description="required/preferred/gap")
    similarity_score: float = Field(..., ge=0, le=1, description="Cosine similarity (0-1)")
    found_in_resume: bool
    verification_question: Optional[str] = Field(
        None, description="Question to verify this skill in interview"
    )


class JDMatch(BaseModel):
    """Overall match analysis: resume vs JD"""

    candidate_id: str
    job_id: str
    overall_fit_score: Optional[float] = Field(None, ge=0, le=1, description="Overall match 0-1")
    experience_match: Optional[float] = Field(None, ge=0, le=1)
    skill_coverage: Optional[float] = Field(None, ge=0, le=1)

    # Detailed matches
    required_skills_found: List[SkillMatch]
    required_skills_missing: List[SkillMatch]
    preferred_skills_found: List[SkillMatch]

    # Interview recommendations
    priority_skills_to_verify: List[str] = Field(
        ..., description="Top skills to focus interview questions on"
    )
    gap_areas: List[str] = Field(..., description="Skills to probe/challenge candidate on")
    strength_areas: List[str] = Field(..., description="Where candidate exceeds requirements")

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class JDMatcher:
    """
    Match resume against job description using semantic similarity.

    Pipeline:
    1. Parse JD to extract required/preferred skills
    2. Get embeddings for all resume skills
    3. Get embeddings for all JD skills
    4. Compute cosine similarity between each pair
    5. Classify as required, preferred, or gap
    6. Generate interview questions for gaps and verification
    """

    def __init__(
        self,
        provider: DemoProvider | GroqProvider | None = None,
        *,
        openai_client=None,
    ):
        """
        Initialize JD matcher.

        Args:
            provider: Provider abstraction for job-description extraction.
        """
        if openai_client is not None:
            raise ValueError("Pass an LLM provider instead of an OpenAI client.")
        self.provider = provider
        self.embedding_cache: dict[str, list] = {}

    async def parse_job_description(self, jd_text: str, job_title: str = "", company: str = "") -> JobDescription:
        """
        Extract requirements from job description text using LLM.

        Args:
            jd_text: Full job description text
            job_title: Job title (for context)
            company: Company name (for context)

        Returns:
            Structured JobDescription with extracted requirements
        """

        if not self.provider:
            logger.info("No JD extraction provider configured; retaining source text only")
            return JobDescription(
                job_id="unknown",
                job_title=job_title or "Unknown",
                company=company or "Unknown",
                experience_required_years=0,
                seniority_level="mid",
                required_skills=[],
                job_description_text=jd_text,
            )

        try:
            system_prompt = """You are an expert job requirements analyzer. Extract key requirements from job descriptions.

Your task:
1. Extract all required technical skills (must-have)
2. Extract preferred/nice-to-have skills
3. Identify experience level requirement (junior/mid/senior/staff)
4. Calculate years of experience from text ("5+ years", "3-5 years", etc.)
5. Format skills as single words or short phrases (e.g., "Python", "React", "AWS", "REST APIs")

Return ONLY a valid JSON object. Do NOT include markdown formatting."""

            user_prompt = f"""Extract requirements from this job description:

Title: {job_title}
Company: {company}

{jd_text}

Return JSON with:
- experience_required_years (integer)
- seniority_level (junior/mid/senior/staff)
- required_skills (list of required technical skills, lowercase)
- preferred_skills (list of preferred skills)
- nice_to_have (list of other nice-to-have qualities)"""

            response = await self.provider.complete(
                [
                    ChatMessage(role="system", content=system_prompt),
                    ChatMessage(role="user", content=user_prompt),
                ],
                purpose="live",
                temperature=0.2,
                max_tokens=1000,
            )

            json_str = response.strip()
            jd_dict = json.loads(json_str)

            jd = JobDescription(
                job_id=f"jd_{datetime.utcnow().timestamp()}",
                job_title=job_title,
                company=company,
                job_description_text=jd_text,
                **jd_dict,
            )

            logger.info(
                f"✅ Parsed JD for {jd.job_title}: "
                f"{len(jd.required_skills)} required skills, "
                f"{len(jd.preferred_skills)} preferred"
            )
            return jd

        except ProviderError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to parse JD: {e}")
            return JobDescription(
                job_id="error",
                job_title=job_title,
                company=company,
                experience_required_years=0,
                seniority_level="mid",
                required_skills=[],
                job_description_text=jd_text,
            )

    async def get_embedding(self, text: str) -> Optional[list]:
        """
        Get embedding for text using OpenAI API (with caching).

        Args:
            text: Text to embed

        Returns:
            Embedding vector (1536-dimensional) or None if error
        """

        # Check cache first
        if text in self.embedding_cache:
            return self.embedding_cache[text]

        logger.warning("Embedding provider is unavailable; no semantic embedding was generated.")
        return None

    @staticmethod
    def cosine_similarity(vec1: list, vec2: list) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Similarity score 0-1
        """

        v1 = np.array(vec1)
        v2 = np.array(vec2)

        dot_product = np.dot(v1, v2)
        magnitude = np.linalg.norm(v1) * np.linalg.norm(v2)

        if magnitude == 0:
            return 0.0

        return float(dot_product / magnitude)

    async def match_resume_to_jd(
        self, parsed_resume, job_description: JobDescription, similarity_threshold: float = 0.75
    ) -> JDMatch:
        """
        Match resume skills against JD requirements.

        Args:
            parsed_resume: ParsedResume object from ResumeParser
            job_description: JobDescription from parse_job_description()
            similarity_threshold: Minimum cosine similarity to consider a match (0-1)

        Returns:
            JDMatch with detailed skill analysis
        """

        if not self.provider:
            return JDMatch(
                candidate_id="candidate",
                job_id=job_description.job_id,
                overall_fit_score=None,
                experience_match=None,
                skill_coverage=None,
                required_skills_found=[],
                required_skills_missing=[],
                preferred_skills_found=[],
                priority_skills_to_verify=[],
                gap_areas=[],
                strength_areas=[],
            )

        try:
            # Get embeddings for all skills
            resume_skill_embeddings: dict[str, list] = {}
            for skill in parsed_resume.technical_skills:
                emb = await self.get_embedding(skill)
                if emb:
                    resume_skill_embeddings[skill] = emb

            jd_required_embeddings: dict[str, list] = {}
            for skill in job_description.required_skills:
                emb = await self.get_embedding(skill)
                if emb:
                    jd_required_embeddings[skill] = emb

            jd_preferred_embeddings: dict[str, list] = {}
            for skill in job_description.preferred_skills:
                emb = await self.get_embedding(skill)
                if emb:
                    jd_preferred_embeddings[skill] = emb

            if not resume_skill_embeddings or not jd_required_embeddings:
                return JDMatch(
                    candidate_id="candidate",
                    job_id=job_description.job_id,
                    overall_fit_score=None,
                    experience_match=None,
                    skill_coverage=None,
                    required_skills_found=[],
                    required_skills_missing=[],
                    preferred_skills_found=[],
                    priority_skills_to_verify=[],
                    gap_areas=[],
                    strength_areas=[],
                )

            # Match required skills
            required_found: List[SkillMatch] = []
            required_missing: List[SkillMatch] = []

            for jd_skill, jd_emb in jd_required_embeddings.items():
                best_match_score = 0.0
                best_match_skill = None

                # Find best resume skill match
                for res_skill, res_emb in resume_skill_embeddings.items():
                    similarity = self.cosine_similarity(jd_emb, res_emb)
                    if similarity > best_match_score:
                        best_match_score = similarity
                        best_match_skill = res_skill

                if best_match_score >= similarity_threshold:
                    required_found.append(
                        SkillMatch(
                            skill=jd_skill,
                            match_type="required",
                            similarity_score=best_match_score,
                            found_in_resume=True,
                        )
                    )
                else:
                    required_missing.append(
                        SkillMatch(
                            skill=jd_skill,
                            match_type="required",
                            similarity_score=best_match_score,
                            found_in_resume=False,
                        )
                    )

            # Match preferred skills
            preferred_found: List[SkillMatch] = []

            for jd_skill, jd_emb in jd_preferred_embeddings.items():
                best_match_score = 0.0
                best_match_skill = None

                for res_skill, res_emb in resume_skill_embeddings.items():
                    similarity = self.cosine_similarity(jd_emb, res_emb)
                    if similarity > best_match_score:
                        best_match_score = similarity
                        best_match_skill = res_skill

                if best_match_score >= similarity_threshold:
                    preferred_found.append(
                        SkillMatch(
                            skill=jd_skill,
                            match_type="preferred",
                            similarity_score=best_match_score,
                            found_in_resume=True,
                        )
                    )

            # Calculate match scores
            skill_coverage = len(required_found) / max(len(jd_required_embeddings), 1)
            experience_match = min(1.0, parsed_resume.years_experience / max(job_description.experience_required_years, 1))

            overall_fit = (skill_coverage * 0.7) + (experience_match * 0.3)

            # Determine priority skills to verify (weak matches or not found)
            priority_to_verify = [s.skill for s in required_missing[:3]] + [s.skill for s in required_found if s.similarity_score < 0.85][:2]

            # Identify gap areas
            gap_areas = [s.skill for s in required_missing]

            # Identify strength areas
            strength_areas = [s.skill for s in required_found if s.similarity_score > 0.90]

            match = JDMatch(
                candidate_id="candidate",  # TODO: Pass actual ID
                job_id=job_description.job_id,
                overall_fit_score=overall_fit,
                experience_match=experience_match,
                skill_coverage=skill_coverage,
                required_skills_found=required_found,
                required_skills_missing=required_missing,
                preferred_skills_found=preferred_found,
                priority_skills_to_verify=priority_to_verify,
                gap_areas=gap_areas,
                strength_areas=strength_areas,
            )

            logger.info(
                f"✅ Matched resume to JD: "
                f"overall_fit={overall_fit:.2f}, "
                f"skill_coverage={skill_coverage:.0%}, "
                f"gaps={len(gap_areas)}"
            )

            return match

        except Exception as e:
            logger.error(f"❌ Failed to match resume to JD: {e}")
            return JDMatch(
                candidate_id="error",
                job_id=job_description.job_id,
                overall_fit_score=0.0,
                experience_match=0.0,
                skill_coverage=0.0,
                required_skills_found=[],
                required_skills_missing=[],
                preferred_skills_found=[],
                priority_skills_to_verify=[],
                gap_areas=[],
                strength_areas=[],
            )
