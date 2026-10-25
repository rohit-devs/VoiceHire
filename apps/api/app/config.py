"""Backend settings loaded from environment or the repository .env file."""
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_ROOT / ".env.local", REPOSITORY_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",  # CRITICAL: ignore NEXT_PUBLIC_* and unknown vars
    )

    # ── Runtime ──
    APP_ENV: str = "development"
    DEMO_MODE: bool = False

    # ── Database ──
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicehire_local.db"

    # ── LLM provider ──
    LLM_PROVIDER: str = "auto"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"

    # ── STT provider ──
    STT_PROVIDER: str = "auto"
    DEEPGRAM_API_KEY: str = ""
    DEEPGRAM_MODEL: str = "nova-3"
    EVALUATION_RUBRIC_WEIGHTS: str = ""

    # ── AI (Groq) ──
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_FAST_MODEL: str = "llama-3.1-8b-instant"
    GROQ_STRONG_MODEL: str = "llama-3.3-70b-versatile"

    # ── Agora ──
    AGORA_APP_ID: str = ""
    AGORA_APP_CERTIFICATE: str = ""
    AGORA_TOKEN_EXPIRATION: int = 3600

    # ── CORS / Hosts ──
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,*.vercel.app"

    @property
    def cors_origins_list(self) -> List[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]

    @property
    def allowed_hosts_list(self) -> List[str]:
        return [x.strip() for x in self.ALLOWED_HOSTS.split(",") if x.strip()]

    @property
    def groq_enabled(self) -> bool:
        return bool(self.GROQ_API_KEY) and len(self.GROQ_API_KEY) > 20

    @property
    def deepgram_enabled(self) -> bool:
        return bool(self.DEEPGRAM_API_KEY) and len(self.DEEPGRAM_API_KEY) > 20

    @property
    def agora_enabled(self) -> bool:
        return bool(self.AGORA_APP_ID and self.AGORA_APP_CERTIFICATE and len(self.AGORA_APP_ID) == 32)

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")


settings = Settings()
