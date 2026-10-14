"""
Flexible settings — loads from .env.local/.env but NEVER crashes on missing vars.
Frontend-only vars (NEXT_PUBLIC_*) are silently ignored.
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",  # CRITICAL: ignore NEXT_PUBLIC_* and unknown vars
    )

    # ── Database ──
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicehire_demo.db"
    DATABASE_URL_NON_POOLING: Optional[str] = None

    # ── AI ──
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TEMPERATURE: float = 0.3
    OPENAI_MAX_TOKENS: int = 500

    # ── Agora ──
    AGORA_APP_ID: str = ""
    AGORA_APP_CERTIFICATE: str = ""
    AGORA_CUSTOMER_ID: str = ""
    AGORA_CUSTOMER_SECRET: str = ""
    AGORA_TOKEN_EXPIRATION: int = 3600

    # ── Clerk ──
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_JWT_JWKS_URL: str = ""

    # ── CORS / Hosts ──
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,*.vercel.app"

    # ── Interview defaults ──
    DEFAULT_INTERVIEW_DURATION: int = 600
    DEFAULT_DIFFICULTY: str = "medium"
    DEFAULT_PERSONA: str = "technical"

    # ── Feature flags ──
    DEMO_MODE: bool = os.environ.get("NODE_ENV", "development") == "development"

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
