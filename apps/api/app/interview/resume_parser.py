"""
Phase 4A: Resume Parsing
Extracts structured data from resumes (PDF/text) using OpenAI GPT-4o-mini.

Extracts:
- Name, email, phone
- Work experience (company, role, duration, skills)
- Education (degree, major, university)
- Skills (technical and non-technical)
- Projects (name, description, technologies)
- Certifications
"""

import json
import logging
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class WorkExperience(BaseModel):
    """Work experience entry"""

    company: str
    job_title: str
    duration_start: str = Field(..., description="Start date (YYYY-MM)")
    duration_end: Optional[str] = Field(None, description="End date (YYYY-MM) or 'Present'")
    description: Optional[str] = Field(None, description="Job responsibilities")
    technologies: List[str] = Field(default_factory=list, description="Technologies used")
    achievements: List[str] = Field(default_factory=list, description="Key achievements")


class Education(BaseModel):
    """Education entry"""

    institution: str
    degree: str  # e.g., "Bachelor of Science"
    major: str  # e.g., "Computer Science"
    graduation_year: Optional[int] = None
    gpa: Optional[str] = None
    honors: Optional[str] = Field(None, description="Honors/distinctions")


class Project(BaseModel):
    """Project entry"""

    name: str
    description: str
    technologies: List[str]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    link: Optional[str] = Field(None, description="GitHub or project URL")


class Certification(BaseModel):
    """Certification entry"""

    name: str
    issuer: str
    date_obtained: Optional[str] = None
    expiry_date: Optional[str] = None


class ParsedResume(BaseModel):
    """Fully parsed resume"""

    # Contact info
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

    # Professional info
    work_experience: List[WorkExperience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[Certification] = Field(default_factory=list)

    # Skills (aggregated from sections)
    technical_skills: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)
    all_technologies: List[str] = Field(default_factory=list)

    # Summary
    professional_summary: Optional[str] = Field(None, description="Objective/summary section")
    years_experience: Optional[int] = Field(None, description="Total years of experience")
    seniority_level: Optional[str] = Field(None, description="junior/mid/senior/staff")

    # Metadata
    parsing_confidence: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ResumeParser:
    """
    Parse resumes using OpenAI GPT-4o-mini with structured JSON output.

    Supports:
    - Plain text resumes
    - Parsed PDF text (via pypdf or similar)

    NOT supported:
    - Direct PDF file parsing (pass pre-extracted text instead)
    - Image-based resumes (need OCR first)
    """

    def __init__(self, openai_client=None):
        """
        Initialize resume parser.

        Args:
            openai_client: AsyncOpenAI client for LLM calls
        """
        self.client = openai_client

    async def parse(self, resume_text: str) -> ParsedResume:
        """
        Parse resume text into structured format.

        Args:
            resume_text: Full resume text (plain text or markdown)

        Returns:
            ParsedResume with extracted structured data
        """

        if not self.client:
            logger.info("No resume extraction provider configured; retaining source text only")
            return ParsedResume(
                full_name="Candidate",
                professional_summary=resume_text,
                parsing_confidence=0.0,
            )

        try:
            system_prompt = """You are an expert resume parser. Extract all information from the resume into a structured JSON format.

Your task:
1. Extract all sections: contact info, work experience, education, projects, skills, certifications
2. Normalize dates to YYYY-MM format
3. Infer seniority level based on experience (junior=0-2 years, mid=3-7 years, senior=8-12 years, staff=13+ years)
4. Calculate total years of experience
5. Categorize skills into technical_skills (languages, frameworks, tools) and soft_skills
6. Extract all unique technologies mentioned
7. Rate parsing confidence (1.0 = certain, 0.5 = uncertain, 0.0 = missing major section)

Return ONLY a valid JSON object matching the ParsedResume schema. Do NOT include markdown formatting or extra text."""

            user_prompt = f"""Parse this resume into structured JSON:

{resume_text}

Return a JSON object with these fields:
- full_name, email, phone, location, linkedin_url, github_url
- work_experience: [{{company, job_title, duration_start, duration_end, description, technologies[], achievements[]}}]
- education: [{{institution, degree, major, graduation_year, gpa, honors}}]
- projects: [{{name, description, technologies[], start_date, end_date, link}}]
- certifications: [{{name, issuer, date_obtained, expiry_date}}]
- technical_skills[], soft_skills[], all_technologies[]
- professional_summary, years_experience, seniority_level
- parsing_confidence (0.0-1.0)

Ensure all lists are populated. If a field is not found, use null or empty list."""

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.2,  # Low temperature for consistency
                max_completion_tokens=2000,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    }
                ],
            )

            # Parse response
            json_str = response.choices[0].message.content.strip()
            resume_dict = json.loads(json_str)

            # Validate with Pydantic
            parsed_resume = ParsedResume(**resume_dict)

            logger.info(f"✅ Successfully parsed resume for: {parsed_resume.full_name}")
            logger.debug(
                f"Extracted: {len(parsed_resume.work_experience)} jobs, "
                f"{len(parsed_resume.education)} degrees, "
                f"{len(parsed_resume.technical_skills)} technical skills"
            )

            return parsed_resume

        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON from resume parser: {e}")
            return ParsedResume(
                full_name="Parse Error",
                professional_summary=f"Failed to parse: {str(e)}",
                parsing_confidence=0.0,
            )
        except Exception as e:
            logger.error(f"❌ Failed to parse resume: {e}")
            return ParsedResume(
                full_name="Error",
                professional_summary=f"Parser error: {str(e)}",
                parsing_confidence=0.0,
            )

    def infer_priority_competencies(self, parsed_resume: ParsedResume, job_description: Optional[str] = None) -> List[str]:
        """
        Infer top technical skills most relevant for interview.

        Strategy:
        1. Use skills that appear in multiple jobs (frequency analysis)
        2. Use skills from most recent job (recency)
        3. If JD provided, match against JD keywords
        4. Return top 5-7 skills

        Args:
            parsed_resume: Parsed resume object
            job_description: Optional job description to match against

        Returns:
            List of priority technical skills for interview focus
        """

        # Frequency analysis: count skill mentions
        skill_count = {}
        for job in parsed_resume.work_experience:
            for tech in job.technologies:
                skill_count[tech] = skill_count.get(tech, 0) + 1

        # Sort by frequency (descending) then alphabetically
        sorted_skills = sorted(skill_count.items(), key=lambda x: (-x[1], x[0]))

        # Take top 7 skills
        priority_skills = [skill for skill, _ in sorted_skills[:7]]

        # If no skills from jobs, fall back to all technical skills
        if not priority_skills:
            priority_skills = parsed_resume.technical_skills[:7]

        logger.info(f"Inferred priority competencies: {priority_skills}")
        return priority_skills


class ResumeDB:
    """Simple in-memory resume storage for this session (in production, use database)"""

    def __init__(self):
        self.resumes: dict[str, ParsedResume] = {}

    def store(self, candidate_id: str, parsed_resume: ParsedResume):
        """Store parsed resume"""
        self.resumes[candidate_id] = parsed_resume
        logger.info(f"✅ Stored resume for candidate: {candidate_id}")

    def get(self, candidate_id: str) -> Optional[ParsedResume]:
        """Retrieve stored resume"""
        return self.resumes.get(candidate_id)

    def get_skills(self, candidate_id: str) -> List[str]:
        """Get technical skills for candidate"""
        resume = self.get(candidate_id)
        return resume.technical_skills if resume else []

    def get_experience_years(self, candidate_id: str) -> int:
        """Get years of experience"""
        resume = self.get(candidate_id)
        return resume.years_experience or 0 if resume else 0
