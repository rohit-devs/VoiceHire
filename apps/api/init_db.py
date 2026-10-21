#!/usr/bin/env python3
"""
Standalone script to initialize the database.
Applies pending Alembic migrations for the configured database.
"""
import asyncio
from app.database import init_db, close_db


async def main():
    await init_db()
    await close_db()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
