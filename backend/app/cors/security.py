
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.cors.config import settings


def generate_otp() -> str:
    """Generate a cryptographically secure six-digit OTP."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    """Hash the OTP with a server-side secret to resist offline guessing."""
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp_hash(otp: str, stored_hash: str) -> bool:
    """Compare OTP hashes without a timing-sensitive string comparison."""
    return hmac.compare_digest(hash_otp(otp), stored_hash)


def create_access_token(subject: str, role: str) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
