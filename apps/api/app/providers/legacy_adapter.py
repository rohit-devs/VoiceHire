"""Adapter for older interview components using completion metadata."""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.providers import ChatMessage, DemoProvider, GroqProvider, OllamaProvider

Provider = DemoProvider | GroqProvider | OllamaProvider


@dataclass(frozen=True)
class ProviderCompletion:
    text: str
    prompt_tokens: int
    completion_tokens: int
    provider: str
    model: str


class LegacyProviderAdapter:
    def __init__(self, provider: Provider, *, purpose: str = "live") -> None:
        self.provider = provider
        self.purpose = purpose

    @property
    def name(self) -> str:
        return self.provider.name

    async def complete(
        self,
        *,
        session_id: str,
        system_prompt: str,
        user_content: str,
        max_tokens: int,
    ) -> ProviderCompletion:
        text = await self.provider.complete(
            [
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_content),
            ],
            purpose=self.purpose,
            max_tokens=max_tokens,
        )
        is_local = self.provider.name == "ollama"
        return ProviderCompletion(
            text=text,
            prompt_tokens=0 if is_local else math.ceil(
                (len(system_prompt) + len(user_content)) / 4
            ),
            completion_tokens=0 if is_local else math.ceil(len(text) / 4),
            provider=self.provider.name,
            model=self.provider.model_for(self.purpose),
        )
