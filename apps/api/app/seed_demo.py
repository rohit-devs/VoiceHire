"""Insert the explicitly labeled local demo identity."""

import asyncio

from sqlalchemy import select

from app.auth import _DEMO_USER
from app.config import settings
from app.database import async_session
from app.models import User


async def seed_demo_user() -> None:
    if not settings.DEMO_MODE:
        raise RuntimeError("Demo seed refused: DEMO_MODE must be enabled.")

    async with async_session() as session:
        existing = await session.scalar(
            select(User).where(User.clerk_id == _DEMO_USER["clerk_id"])
        )
        if existing is None:
            session.add(
                User(
                    id=_DEMO_USER["id"],
                    email=_DEMO_USER["email"],
                    clerk_id=_DEMO_USER["clerk_id"],
                    first_name=_DEMO_USER["first_name"],
                    last_name=_DEMO_USER["last_name"],
                )
            )
            await session.commit()


def main() -> None:
    asyncio.run(seed_demo_user())
    print("[DEMO SEED] Demo user is ready.")


if __name__ == "__main__":
    main()
