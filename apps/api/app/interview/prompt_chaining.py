"""
Phase 3C: Prompt Chaining Pipeline
Connects: ASR → ResponseAnalyzer → Orchestrator → Interviewer Prompt

This module orchestrates the closed-loop evaluation flow:
1. Candidate speech captured (via WebSocket transcript message)
2. ResponseAnalyzer evaluates response (scores, filler words, recommended action)
3. Orchestrator processes evaluation (adjusts difficulty, transitions state, broadcasts)
4. Next question generated from updated interviewer prompt
5. TTS converts question to audio
6. Audio played to candidate via Agora
7. Loop repeats

The "chaining" means each step uses output from previous step as input to next step.
"""

import json
import logging
from typing import Optional
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class QuestionGenerationRequest(BaseModel):
    """Request to generate next interview question"""

    session_id: str = Field(..., description="Interview session ID")
    current_state: str = Field(
        ..., description="Current interview state (intro/warmup/technical/behavioral/pressure/closing)"
    )
    difficulty_level: int = Field(..., ge=1, le=3, description="Interview difficulty (1=easy, 2=medium, 3=hard)")
    candidate_transcript: str = Field(..., description="Candidate's last response (full text)")
    candidate_name: Optional[str] = Field(None, description="Candidate's name for personalization")
    target_role: Optional[str] = Field(None, description="Target job position")
    priority_competencies: Optional[list[str]] = Field(None, description="Key skills for role (from JD)")
    resume_claims: Optional[list[str]] = Field(None, description="Claimed skills from resume")
    previous_weaknesses: Optional[list[str]] = Field(None, description="Areas candidate struggled with")
    experience_level: Optional[str] = Field(None, description="Expected experience level (junior/mid/senior)")

    # Analyzer output (injected by orchestrator after analyzing candidate response)
    analyzer_feedback: Optional[dict] = Field(
        None,
        description="ResponseAnalyzer output: {technical_score, clarity_score, confidence_score, filler_words_detected, recommended_action, state_transition}",
    )


class GeneratedQuestion(BaseModel):
    """AI-generated interview question ready for TTS"""

    session_id: str
    question_text: str = Field(..., description="Next question to ask candidate (1-3 sentences)")
    state: str = Field(..., description="Interview state this question belongs to")
    difficulty_level: int
    reasoning: str = Field(..., description="Why this question was chosen (for logging/debugging)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class PromptChainCoordinator:
    """
    Coordinates the prompt chaining pipeline.

    Responsibilities:
    1. Load and template the interviewer prompt (from interviewer.yaml)
    2. Inject runtime context (candidate profile, current state, analyzer feedback)
    3. Call LLM to generate next question
    4. Return question for TTS conversion

    NOT responsibilities:
    - Analyzing candidate responses (that's ResponseAnalyzer)
    - Managing interview state (that's InterviewOrchestrator)
    - Managing WebSocket connections (that's ConnectionManager)
    """

    # Question templates by state (fallback if LLM call fails)
    FALLBACK_QUESTIONS = {
        "intro": "Hi, thanks for joining me today! Are you ready to discuss the {{target_role}} role?",
        "warmup": "Tell me about the most interesting project you've worked on recently. What made it engaging for you?",
        "technical": "Let's dive into your technical experience. Walk me through the most complex {{priority_competencies[0]}} project you've built.",
        "behavioral": "Tell me about a time you had to learn something new quickly. How did you approach it?",
        "pressure": "You mentioned {{previous_weaknesses}} earlier. In a production environment with high scale, how would you handle that?",
        "closing": "Before we wrap up, do you have any questions for me about the {{target_role}} or our team?",
    }

    def __init__(self, openai_client=None, yaml_prompt_path: str = None):
        """
        Initialize prompt chain coordinator.

        Args:
            openai_client: AsyncOpenAI client for LLM calls
            yaml_prompt_path: Path to interviewer.yaml prompt template
        """
        self.client = openai_client
        self.yaml_prompt_path = yaml_prompt_path or "packages/prompts/interviewer.yaml"
        self.system_prompt_template = None
        self._load_prompt_template()

    def _load_prompt_template(self):
        """Load and parse interviewer.yaml to extract system prompt template"""
        try:
            import yaml

            with open(self.yaml_prompt_path, "r") as f:
                prompt_data = yaml.safe_load(f)
                self.system_prompt_template = prompt_data.get("system_prompt", "")
                logger.info(f"✅ Loaded interviewer prompt template from {self.yaml_prompt_path}")
        except Exception as e:
            logger.warning(f"⚠️  Failed to load prompt template: {e}. Using inline templates.")
            self.system_prompt_template = ""

    def _template_system_prompt(self, context: QuestionGenerationRequest) -> str:
        """
        Inject runtime context into system prompt template.

        Replaces variables like {{candidate_name}}, {{current_state}}, {{analyzer_feedback}} etc.
        """
        prompt = self.system_prompt_template or ""

        # Inject context variables
        context_dict = {
            "candidate_name": context.candidate_name or "Candidate",
            "target_role": context.target_role or "the role",
            "current_state": context.current_state,
            "difficulty_level": context.difficulty_level,
            "experience_level": context.experience_level or "experienced",
            "priority_competencies": ", ".join(context.priority_competencies or []),
            "resume_claims": ", ".join(context.resume_claims or []),
            "previous_weaknesses": ", ".join(context.previous_weaknesses or []),
            "analyzer_feedback": json.dumps(context.analyzer_feedback or {}, indent=2),
        }

        # Simple template substitution
        for key, value in context_dict.items():
            prompt = prompt.replace(f"{{{{{key}}}}}", str(value))

        return prompt

    async def generate_next_question(self, request: QuestionGenerationRequest) -> GeneratedQuestion:
        """
        Generate next interview question using LLM.

        Prompt chaining flow:
        1. Input: Candidate response analysis (from ResponseAnalyzer)
        2. Process: Inject context into interviewer prompt
        3. LLM call: Generate question tailored to state + difficulty + feedback
        4. Output: Next question ready for TTS

        Args:
            request: QuestionGenerationRequest with context and analyzer feedback

        Returns:
            GeneratedQuestion with next question text and reasoning
        """

        if not self.client:
            logger.warning("⚠️  No OpenAI client configured. Using fallback question.")
            return GeneratedQuestion(
                session_id=request.session_id,
                question_text=self._get_fallback_question(request.current_state, request),
                state=request.current_state,
                difficulty_level=request.difficulty_level,
                reasoning="Fallback: No LLM client available",
            )

        try:
            # Step 1: Template the system prompt with runtime context
            system_prompt = self._template_system_prompt(request)

            # Step 2: Build the user message with analyzer feedback
            user_message = self._build_user_message(request)

            # Step 3: Call LLM (GPT-4o-mini) to generate next question
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.3,  # Low temperature for consistency
                max_tokens=300,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    }
                ],
            )

            question_text = response.choices[0].message.content.strip()

            # Validate question length (1-3 sentences)
            sentences = question_text.split(". ")
            if len(sentences) > 3:
                logger.warning(f"⚠️  Generated question too long ({len(sentences)} sentences), truncating")
                question_text = ". ".join(sentences[:3]) + "."

            logger.info(f"✅ Generated question for state={request.current_state}, difficulty={request.difficulty_level}")
            logger.debug(f"Question: {question_text}")

            return GeneratedQuestion(
                session_id=request.session_id,
                question_text=question_text,
                state=request.current_state,
                difficulty_level=request.difficulty_level,
                reasoning=f"Generated by GPT-4o-mini. Analyzer feedback: {request.analyzer_feedback.get('recommended_action') if request.analyzer_feedback else 'N/A'}",
            )

        except Exception as e:
            logger.error(f"❌ Error generating question: {e}")
            return GeneratedQuestion(
                session_id=request.session_id,
                question_text=self._get_fallback_question(request.current_state, request),
                state=request.current_state,
                difficulty_level=request.difficulty_level,
                reasoning=f"LLM call failed: {str(e)}. Using fallback.",
            )

    def _build_user_message(self, request: QuestionGenerationRequest) -> str:
        """Build user message for LLM based on state and analyzer feedback"""

        base_message = f"""
Current interview state: {request.current_state}
Difficulty level: {request.difficulty_level}
Candidate: {request.candidate_name}
Target role: {request.target_role}
Experience level: {request.experience_level}

Candidate's last response:
"{request.candidate_transcript}"
"""

        # Append analyzer feedback if available
        if request.analyzer_feedback:
            feedback = request.analyzer_feedback
            base_message += f"""

Analysis of response:
- Technical score: {feedback.get('technical_score', 'N/A')}/100
- Clarity score: {feedback.get('clarity_score', 'N/A')}/100
- Confidence score: {feedback.get('confidence_score', 'N/A')}/100
- Filler words: {', '.join(feedback.get('filler_words_detected', [])) or 'None'}
- Recommended action: {feedback.get('recommended_action', 'move_on')}
- State transition suggestion: {feedback.get('state_transition', 'None')}
"""

        base_message += f"""

Based on this analysis and the current state ({request.current_state}), 
generate the next question to ask the candidate.

Requirements:
- Exactly 1 question, 1-3 sentences max
- Match difficulty level {request.difficulty_level} (1=easy, 2=medium, 3=hard)
- If recommended_action is "challenge": Go harder, ask trade-offs or edge cases
- If recommended_action is "clarify": Ask for specific examples or deeper explanation
- If recommended_action is "move_on": Transition to next topic
- If recommended_action is "simplify": Ask more foundational question
- Never reveal scoring or internal reasoning
- Be conversational and natural
"""

        return base_message

    def _get_fallback_question(self, state: str, request: QuestionGenerationRequest) -> str:
        """Get fallback question if LLM fails"""

        question_template = self.FALLBACK_QUESTIONS.get(state, "Tell me more about that.")

        # Simple template substitution for fallback
        question_template = question_template.replace("{{target_role}}", request.target_role or "the role")
        question_template = question_template.replace(
            "{{priority_competencies[0]}}", request.priority_competencies[0] if request.priority_competencies else "this topic"
        )
        question_template = question_template.replace(
            "{{previous_weaknesses}}", request.previous_weaknesses[0] if request.previous_weaknesses else "that area"
        )

        return question_template

    async def handle_analyzer_output_and_generate_question(
        self, orchestrator, session_id: str, analyzer_output: dict
    ) -> Optional[GeneratedQuestion]:
        """
        High-level method called by interviews.py after ResponseAnalyzer completes.

        Flow:
        1. Orchestrator processes analyzer output (adjusts difficulty, may transition state)
        2. Build QuestionGenerationRequest with updated context
        3. Generate next question
        4. Return question for TTS

        Args:
            orchestrator: InterviewOrchestrator instance for this session
            session_id: Session ID
            analyzer_output: Dict from ResponseAnalyzer with scores, recommendations

        Returns:
            GeneratedQuestion ready for TTS, or None if error
        """

        try:
            # Build request from orchestrator state + analyzer output
            request = QuestionGenerationRequest(
                session_id=session_id,
                current_state=orchestrator.current_state,
                difficulty_level=orchestrator.difficulty_level,
                candidate_transcript="[Last candidate response]",  # This should be passed in separately
                candidate_name=orchestrator.candidate_name,
                target_role=orchestrator.target_role,
                priority_competencies=orchestrator.priority_competencies,
                resume_claims=orchestrator.resume_claims,
                previous_weaknesses=orchestrator.previous_weaknesses,
                experience_level=orchestrator.experience_level,
                analyzer_feedback=analyzer_output,
            )

            question = await self.generate_next_question(request)
            logger.info(f"✅ Generated next question after analyzer output for session {session_id}")
            return question

        except Exception as e:
            logger.error(f"❌ Error in prompt chaining: {e}")
            return None
