"""Insert the explicitly labeled local demo guest identity."""

import asyncio

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import User

DEMO_GUEST_ID = "demo-user-001"


async def seed_demo_user() -> None:
    if not settings.DEMO_MODE:
        raise RuntimeError("Demo seed refused: DEMO_MODE must be enabled.")

    async with async_session() as session:
        existing = await session.scalar(
            select(User).where(User.guest_id == DEMO_GUEST_ID)
        )
        if existing is None:
            session.add(
                User(
                    id=DEMO_GUEST_ID,
                    guest_id=DEMO_GUEST_ID,
                    email="demo@voicehire.ai",
                    first_name="Demo",
                    last_name="User",
                )
            )
            await session.commit()


def main() -> None:
    asyncio.run(seed_demo_user())
    print("[DEMO SEED] Demo guest is ready.")


if __name__ == "__main__":
    main()
