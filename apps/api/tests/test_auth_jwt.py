"""Regression tests for Clerk JWT verification using the pinned RS256 algorithm."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app import auth
from app.config import settings


@pytest.fixture
def clerk_jwt_keypair(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk["kid"] = "test-key"
    monkeypatch.setattr(
        settings,
        "CLERK_JWT_JWKS_URL",
        "https://clerk.example/.well-known/jwks.json",
    )

    async def get_jwks():
        return {"keys": [public_jwk]}

    monkeypatch.setattr(auth, "_get_jwks", get_jwks)
    return private_key


def _claims() -> dict:
    return {
        "sub": "candidate-123",
        "iss": "https://clerk.example",
        "email": "candidate@example.test",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }


@pytest.mark.asyncio
async def test_clerk_rs256_token_is_verified_from_jwks(clerk_jwt_keypair):
    token = jwt.encode(
        _claims(),
        clerk_jwt_keypair,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    user = await auth._verify_clerk_token(token)

    assert user["id"] == "candidate-123"
    assert user["email"] == "candidate@example.test"


@pytest.mark.asyncio
async def test_clerk_jwt_verification_rejects_hmac_algorithm(clerk_jwt_keypair):
    token = jwt.encode(
        _claims(),
        "non-secret-test-signing-value-with-32-bytes",
        algorithm="HS256",
        headers={"kid": "test-key"},
    )

    with pytest.raises(HTTPException) as error:
        await auth._verify_clerk_token(token)

    assert error.value.status_code == 401
