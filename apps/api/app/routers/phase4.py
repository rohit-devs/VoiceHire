"""
Phase 4 API Endpoints: Resume Upload, JD Parsing, and Blueprint Generation
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.interview.resume_parser import ResumeParser, ResumeDB
from app.interview.jd_matcher import JDMatcher
from app.interview.interview_blueprint import BlueprintBuilder
from app.providers import ProviderError, get_llm_provider

logger = logging.getLogger(__name__)
router = APIRouter()

# Global singletons
resume_parser: Optional[ResumeParser] = None
resume_db: Optional[ResumeDB] = None
jd_matcher: Optional[JDMatcher] = None
blueprint_builder: Optional[BlueprintBuilder] = None
job_descriptions: dict[str, object] = {}


def _live_llm_provider():
    provider = get_llm_provider()
    if provider.simulated:
        raise ProviderError("LLM provider is disabled for resume and job-description parsing.")
    return provider


def get_resume_parser() -> ResumeParser:
    """Get or create ResumeParser singleton"""
    global resume_parser
    if resume_parser is None:
        resume_parser = ResumeParser(provider=_live_llm_provider())
    return resume_parser


def get_resume_db() -> ResumeDB:
    """Get or create ResumeDB singleton"""
    global resume_db
    if resume_db is None:
        resume_db = ResumeDB()
    return resume_db


def get_jd_matcher() -> JDMatcher:
    """Get or create JDMatcher singleton"""
    global jd_matcher
    if jd_matcher is None:
        jd_matcher = JDMatcher(provider=_live_llm_provider())
    return jd_matcher


def get_blueprint_builder() -> BlueprintBuilder:
    """Get or create BlueprintBuilder singleton"""
    global blueprint_builder
    if blueprint_builder is None:
        blueprint_builder = BlueprintBuilder()
    return blueprint_builder


class ResumeUploadRequest(BaseModel):
    """Request to parse and store resume"""

    candidate_id: str
    resume_text: str  # Plain text resume (pre-extracted from PDF)
    candidate_name: Optional[str] = None


class ResumeUploadResponse(BaseModel):
    """Response from resume parsing"""

    candidate_id: str
    candidate_name: str
    years_experience: int
    technical_skills: list[str]
    seniority_level: str
    parsing_confidence: float
    message: str


class JDUploadRequest(BaseModel):
    """Request to parse job description"""

    job_id: str
    jd_text: str  # Full job description text
    job_title: str
    company: str


class JDUploadResponse(BaseModel):
    """Response from JD parsing"""

    job_id: str
    job_title: str
    company: str
    experience_required: int
    seniority_level: str
    required_skills: list[str]
    preferred_skills: list[str]
    message: str


class BlueprintGenerateRequest(BaseModel):
    """Request to generate interview blueprint"""

    candidate_id: str
    job_id: str
    session_id: Optional[str] = None


class BlueprintGenerateResponse(BaseModel):
    """Response with interview blueprint"""

    session_id: str
    candidate_name: str
    target_role: str
    company: str
    overall_fit_score: float
    estimated_difficulty_level: int
    interview_focus_areas: list[str]
    skill_gaps: list[str]
    skill_strengths: list[str]
    expected_duration_seconds: int
    message: str


@router.post("/candidates/{candidate_id}/resume", response_model=ResumeUploadResponse)
async def upload_and_parse_resume(
    candidate_id: str,
    request: ResumeUploadRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Phase 4A: Upload and parse resume.

    Args:
    - `candidate_id`: Candidate ID
    - `resume_text`: Plain text resume content (pre-extracted from PDF)
    - `candidate_name`: Optional candidate name for verification

    Returns:
    - Parsed resume data: skills, experience, education
    - Parsing confidence score

    Note: In production, integrate with PDF extraction library (pypdf, pdfplumber, etc.)
    """
    try:
        parser = get_resume_parser()
        resume_db = get_resume_db()

        logger.info(f"📄 Parsing resume for candidate: {candidate_id}")

        # Parse resume
        parsed_resume = await parser.parse(request.resume_text)

        # Store in memory (in production, save to database)
        resume_db.store(candidate_id, parsed_resume)

        logger.info(f"✅ Successfully parsed resume: {parsed_resume.full_name}")

        return ResumeUploadResponse(
            candidate_id=candidate_id,
            candidate_name=parsed_resume.full_name,
            years_experience=parsed_resume.years_experience or 0,
            technical_skills=parsed_resume.technical_skills[:10],  # Top 10 skills
            seniority_level=parsed_resume.seniority_level or "mid",
            parsing_confidence=parsed_resume.parsing_confidence,
            message=f"✅ Successfully parsed resume. Extracted {len(parsed_resume.technical_skills)} technical skills.",
        )

    except ProviderError as exc:
        raise HTTPException(
            status_code=429 if exc.status == 429 else 503,
            detail={"user_message": exc.user_message},
        ) from exc
    except Exception as e:
        logger.error(f"❌ Failed to parse resume: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume.")


@router.post("/jobs/{job_id}/description", response_model=JDUploadResponse)
async def upload_and_parse_jd(
    job_id: str,
    request: JDUploadRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Phase 4B: Upload and parse job description.

    Args:
    - `job_id`: Job posting ID
    - `jd_text`: Full job description text
    - `job_title`: Job title
    - `company`: Company name

    Returns:
    - Extracted requirements: required skills, preferred skills, experience level
    """
    try:
        matcher = get_jd_matcher()

        logger.info(f"📋 Parsing JD for job: {request.job_title} at {request.company}")

        # Parse JD
        job_description = await matcher.parse_job_description(
            jd_text=request.jd_text,
            job_title=request.job_title,
            company=request.company,
        )
        job_description = job_description.model_copy(update={"job_id": job_id})
        job_descriptions[job_id] = job_description

        logger.info(f"✅ Successfully parsed JD: {job_description.job_title}")

        return JDUploadResponse(
            job_id=job_id,
            job_title=job_description.job_title,
            company=job_description.company,
            experience_required=job_description.experience_required_years,
            seniority_level=job_description.seniority_level,
            required_skills=job_description.required_skills,
            preferred_skills=job_description.preferred_skills,
            message=f"✅ Successfully parsed JD. Extracted {len(job_description.required_skills)} required skills.",
        )

    except ProviderError as exc:
        raise HTTPException(
            status_code=429 if exc.status == 429 else 503,
            detail={"user_message": exc.user_message},
        ) from exc
    except Exception as e:
        logger.error(f"❌ Failed to parse JD: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse job description.")


@router.post("/blueprint/generate", response_model=BlueprintGenerateResponse)
async def generate_interview_blueprint(
    request: BlueprintGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Phase 4C: Generate personalized interview blueprint.

    Combines:
    - Resume data (from /candidates/{id}/resume endpoint)
    - JD data (from /jobs/{id}/description endpoint)
    - Interview strategy (from BlueprintBuilder)

    Returns:
    - Personalized interview blueprint with focus areas, difficulty level, evaluation criteria
    - Ready to start interview session

    Args:
    - `candidate_id`: Candidate ID (resume must be uploaded first)
    - `job_id`: Job ID (JD must be parsed first)
    - `session_id`: Optional - if creating new interview session, pass here

    Flow:
    1. Frontend uploads resume -> /candidates/{id}/resume
    2. Frontend uploads JD -> /jobs/{id}/description
    3. Frontend calls /blueprint/generate
    4. Returns blueprint + difficulty + focus areas
    5. Frontend uses blueprint to start interview session
    """
    try:
        resume_db = get_resume_db()
        matcher = get_jd_matcher()
        builder = get_blueprint_builder()

        logger.info(f"🎯 Generating blueprint for {request.candidate_id} applying to job {request.job_id}")

        # Retrieve stored data
        parsed_resume = resume_db.get(request.candidate_id)
        if not parsed_resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume for candidate {request.candidate_id} not found. Please upload resume first.",
            )

        job_description = job_descriptions.get(request.job_id)
        if not job_description:
            raise HTTPException(status_code=404, detail="Job description not found. Parse it first.")
        jd_match = await matcher.match_resume_to_jd(parsed_resume, job_description)
        blueprint = await builder.build_blueprint(
            candidate_id=request.candidate_id,
            candidate_name=parsed_resume.full_name,
            parsed_resume=parsed_resume,
            job_id=request.job_id,
            target_role=job_description.job_title,
            company=job_description.company,
            jd_match=jd_match,
            job_description=job_description,
        )
        return BlueprintGenerateResponse(
            session_id=request.session_id or f"interview_{request.candidate_id}_{request.job_id}",
            candidate_name=blueprint.candidate_name,
            target_role=blueprint.target_role,
            company=blueprint.company,
            overall_fit_score=blueprint.overall_fit_score,
            estimated_difficulty_level=blueprint.estimated_difficulty_level,
            interview_focus_areas=blueprint.interview_focus_areas,
            skill_gaps=blueprint.skill_gaps,
            skill_strengths=blueprint.skill_strengths,
            expected_duration_seconds=blueprint.expected_duration_seconds,
            message="Interview blueprint generated successfully.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to generate blueprint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate blueprint: {str(e)}")
