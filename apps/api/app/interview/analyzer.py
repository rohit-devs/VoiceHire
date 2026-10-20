"""
Response Analyzer Agent
Evaluates candidate responses using OpenAI GPT-4o-mini with JSON mode.
Returns structured JSON with scoring and recommended actions.
"""

import logging
import json
import re
import asyncio
from typing import Optional
from pydantic import BaseModel, Field
from app.providers import ProviderError, get_llm_provider
from app.providers.legacy_adapter import LegacyProviderAdapter

logger = logging.getLogger(__name__)


class ResponseAnalysisUnavailable(RuntimeError):
    """Raised when a real response analysis cannot be produced."""


class ResponseAnalysis(BaseModel):
    """
    Structured response analysis result.
    Used for validating analyzer output with Pydantic v2.
    """
    technical_score: int = Field(..., ge=0, le=100, description="Technical accuracy (0-100)")
    relevance_score: int = Field(..., ge=0, le=100, description="Answer relevance (0-100)")
    clarity_score: int = Field(..., ge=0, le=100, description="Communication clarity, structure, and conciseness (0-100)")
    filler_words_detected: list[str] = Field(default_factory=list, description="Filler words found")
    recommended_action: str = Field(
        ...,
        description="Action for interviewer: CHALLENGE|CLARIFY|FOLLOW_UP|DIFFICULTY_UP|DIFFICULTY_DOWN|STATE_TRANSITION"
    )
    follow_up_reason: str = Field(..., description="Why this action is recommended")
    difficulty_adjustment: str = Field(
        ...,
        description="Adjust difficulty: DIFFICULTY_UP|DIFFICULTY_DOWN|NONE"
    )
    state_transition: Optional[str] = Field(
        default=None,
        description="Target state: technical|behavioral|pressure|closing|null"
    )
    star_analysis: Optional[dict] = Field(
        default=None,
        description="STAR analysis for behavioral questions: {situation, task, action, result, missing_components}"
    )


class ResponseAnalyzer:
    """
    Analyzes candidate responses using OpenAI GPT-4o-mini.
    
    Pipeline:
    1. Receive transcript of candidate answer
    2. Send to OpenAI with system prompt + context
    3. Parse JSON response
    4. Validate with Pydantic
    5. Return structured analysis
    
    Targets:
    - TTFT (Time To First Token): < 700ms
    - Processing latency: < 2000ms total
    """

    # Filler words to detect
    FILLER_WORDS = [
        "um", "uh", "like", "basically", "you know", "so", "well",
        "literally", "actually", "kind of", "sort of", "i mean"
    ]

    def __init__(self):
        """
        Initialize analyzer with the environment-selected provider.
        """
        self.provider = LegacyProviderAdapter(get_llm_provider())

    def _extract_filler_words(self, transcript: str) -> list[str]:
        """
        Extract filler words from transcript.
        
        Args:
            transcript: Full candidate response text
        
        Returns:
            List of filler words found (lowercase)
        """
        found = []
        transcript_lower = transcript.lower()
        
        for filler in self.FILLER_WORDS:
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(filler) + r'\b'
            if re.search(pattern, transcript_lower):
                found.append(filler)
        
        return found

    def _analyze_star(self, transcript: str) -> Optional[dict]:
        """
        Analyze behavioral response using STAR method.
        
        Detects presence of:
        - Situation: Context/background
        - Task: What needed to be done
        - Action: What the candidate did
        - Result: Outcome/impact
        
        Args:
            transcript: Candidate's behavioral response
        
        Returns:
            Dict with STAR component presence and missing components
        """
        text_lower = transcript.lower()
        
        # Simple keyword-based STAR detection
        situation_indicators = ["situation", "background", "context", "at the time", "previously", "we were facing", "there was"]
        task_indicators = ["task", "needed to", "had to", "responsibility", "goal was", "objective was", "i was responsible"]
        action_indicators = ["i did", "i led", "i implemented", "i built", "i created", "i managed", "i coordinated", "my approach", "i decided", "i organized"]
        result_indicators = ["result", "outcome", "achieved", "improved", "increased", "reduced", "delivered", "successfully", "impact", "metric", "kpi"]
        
        def detect_any(indicators: list[str], text: str) -> bool:
            return any(indicator in text for indicator in indicators)
        
        situation = detect_any(situation_indicators, text_lower)
        task = detect_any(task_indicators, text_lower)
        action = detect_any(action_indicators, text_lower)
        result = detect_any(result_indicators, text_lower)
        
        missing = []
        if not situation:
            missing.append("situation")
        if not task:
            missing.append("task")
        if not action:
            missing.append("action")
        if not result:
            missing.append("result")
        
        if missing:
            return {
                "situation": situation,
                "task": task,
                "action": action,
                "result": result,
                "missing_components": missing,
                "recommended_follow_up": f"Could you tell me more about the {missing[0]}?",
            }
        
        return {
            "situation": situation,
            "task": task,
            "action": action,
            "result": result,
            "missing_components": [],
            "recommended_follow_up": None,
        }

    async def analyze(
        self,
        candidate_response: str,
        question_asked: str,
        current_state: str,
        candidate_profile: Optional[dict] = None,
        resume_claims: Optional[list[str]] = None
    ) -> ResponseAnalysis:
        """
        Analyze a candidate response.
        
        Args:
            candidate_response: Transcript of candidate's answer
            question_asked: The question that was asked
            current_state: Current interview state (intro, warmup, technical, behavioral, pressure, closing)
            candidate_profile: Optional candidate profile for context
            resume_claims: Optional claims from resume to verify
        
        Returns:
            ResponseAnalysis object with structured scores and recommendations
        """
        try:
            # Detect filler words upfront
            filler_words = self._extract_filler_words(candidate_response)

            # Build context for analyzer
            context_lines = [
                f"Current Interview State: {current_state}",
                f"Question Asked: {question_asked}",
                f"Candidate Response: {candidate_response[:2000]}",  # Limit to 2000 chars for token efficiency
            ]

            if candidate_profile:
                context_lines.append(f"Target Role: {candidate_profile.get('role', 'N/A')}")
                context_lines.append(f"Experience Level: {candidate_profile.get('experience_level', 'N/A')}")

            if resume_claims:
                context_lines.append(f"Resume Claims to Verify: {', '.join(resume_claims[:3])}")

            context = "\n".join(context_lines)

            # Add behavioral STAR analysis if applicable
            star_analysis = None
            if current_state == "behavioral":
                star_analysis = self._analyze_star(candidate_response)
                if star_analysis:
                    context += f"\n\nBehavioral STAR Analysis:\n{json.dumps(star_analysis)}"

            # System prompt for analyzer
            system_prompt = """You are an expert interview evaluator with 20+ years of hiring experience.
Your job is to analyze candidate responses and provide structured scoring.

Scoring Guidelines:
 - technical_score: Accuracy, depth, and relevance of technical knowledge (0-100)
 - relevance_score: How well the answer addresses the question (0-100)
 - clarity_score: Communication clarity, structure, and conciseness (0-100)

Recommended actions:
 - CHALLENGE: Response was weak, ask a harder follow-up
 - CLARIFY: Response was unclear, request clarification
 - FOLLOW_UP: Probe deeper on claimed skills or experiences
 - DIFFICULTY_UP: Strong response, increase difficulty
 - DIFFICULTY_DOWN: Weak response, decrease difficulty
 - STATE_TRANSITION: Ready to move to next interview phase

Always respond with valid JSON matching the required schema."""

            user_message = f"""Analyze this candidate response:

{context}

Return JSON with this exact structure:
{{
  "technical_score": <0-100>,
  "relevance_score": <0-100>,
  "clarity_score": <0-100>,
  "filler_words_detected": {json.dumps(filler_words)},
  "recommended_action": "<CHALLENGE|CLARIFY|FOLLOW_UP|DIFFICULTY_UP|DIFFICULTY_DOWN|STATE_TRANSITION>",
  "follow_up_reason": "<why this action is recommended>",
  "difficulty_adjustment": "<DIFFICULTY_UP|DIFFICULTY_DOWN|NONE>",
  "state_transition": "<technical|behavioral|pressure|closing|null>",
  "star_analysis": {{"situation": <bool>, "task": <bool>, "action": <bool>, "result": <bool>, "missing_components": [<list>], "recommended_follow_up": "<string or null>"}}
}}"""
            analysis = None
            last_error: Exception | None = None
            for attempt in range(3):
                try:
                    response = await self.provider.complete(
                        session_id="response-analysis",
                        system_prompt=system_prompt,
                        user_content=user_message,
                        max_tokens=500,
                    )
                    analysis = ResponseAnalysis.model_validate(
                        json.loads(response.text)
                    )
                    break
                except (json.JSONDecodeError, ValueError) as exc:
                    last_error = exc
                    if attempt < 2:
                        await asyncio.sleep(0.2 * (2**attempt))
            if analysis is None:
                raise last_error or ValueError("Analyzer returned no valid response")
            
            logger.info(
                f"✅ Analysis complete: T={analysis.technical_score}, "
                f"R={analysis.relevance_score}, C={analysis.clarity_score}, "
                f"Action: {analysis.recommended_action}"
            )
            
            return analysis

        except ProviderError:
            raise
        except json.JSONDecodeError as exc:
            logger.error("Response analysis returned invalid JSON")
            raise ResponseAnalysisUnavailable(
                "Response analysis is unavailable; no scores were generated"
            ) from exc
        except Exception as e:
            logger.error("Response analysis failed error_type=%s", type(e).__name__)
            raise ResponseAnalysisUnavailable(
                "Response analysis is unavailable; no scores were generated"
            ) from e

    async def analyze_transcript_segment(
        self,
        segment: str,
        segment_type: str = "full_response"
    ) -> dict:
        """
        Analyze a transcript segment without full evaluation.
        Used for real-time metrics calculation (filler words, pace, clarity).
        
        Args:
            segment: Transcript text segment
            segment_type: Type of segment (full_response, snippet, etc.)
        
        Returns:
            Dict with real-time metrics
        """
        filler_words = self._extract_filler_words(segment)
        word_count = len(segment.split())
        
        return {
            "word_count": word_count,
            "filler_words": filler_words,
            "filler_word_count": len(filler_words),
            "segment_type": segment_type
        }
