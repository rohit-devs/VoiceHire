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
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicehire_demo.db"

    # ── AI ──
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    EVALUATION_RUBRIC_WEIGHTS: str = ""

    # ── Agora ──
    AGORA_APP_ID: str = ""
    AGORA_APP_CERTIFICATE: str = ""
    AGORA_TOKEN_EXPIRATION: int = 3600

    # ── Clerk ──
    CLERK_SECRET_KEY: str = ""
    CLERK_JWT_JWKS_URL: str = ""

    # ── CORS / Hosts ──
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,*.vercel.app"

    @property
    def cors_origins_list(self) -> List[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]

    @property
    def allowed_hosts_list(self) -> List[str]:
        return [x.strip() for x in self.ALLOWED_HOSTS.split(",") if x.strip()]

    @property
    def openai_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY) and len(self.OPENAI_API_KEY) > 20

    @property
    def agora_enabled(self) -> bool:
        return bool(self.AGORA_APP_ID and self.AGORA_APP_CERTIFICATE and len(self.AGORA_APP_ID) == 32)

    @property
    def clerk_enabled(self) -> bool:
        return bool(self.CLERK_SECRET_KEY and not self.CLERK_SECRET_KEY.startswith("sk_test_placeholder") and len(self.CLERK_SECRET_KEY) > 20)

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")


settings = Settings()
