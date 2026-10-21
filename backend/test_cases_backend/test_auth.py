
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.cors.config import settings
from app.cors.database import SessionLocal
from app.cors.security import hash_otp
from app.models.email_login_otp import EmailLoginOTP

client = TestClient(app)


def test_request_otp_rejects_unauthorized_email():
    response = client.post(
        "/api/auth/request-otp",
        json={"email": "unauthorized@example.com"},
    )
    assert response.status_code == 400


def test_me_rejects_missing_token():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_admin_endpoint_rejects_missing_token():
    response = client.get("/api/admin/test")
    assert response.status_code == 401


@patch("app.services.auth_service.send_otp_email")
def test_request_otp_for_admin(mock_send_email):
    response = client.post(
        "/api/auth/request-otp",
        json={"email": settings.admin_email},
    )

    assert response.status_code == 200
    assert response.json()["expires_in_seconds"] == (
        settings.otp_expire_minutes * 60
    )
    mock_send_email.assert_called_once()


def _create_test_otp(email: str, otp: str, expires_in_minutes: int = 5):
    """Create an OTP record for authentication testing."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        record = EmailLoginOTP(
            email=email,
            otp_hash=hash_otp(otp),
            expires_at=now + timedelta(minutes=expires_in_minutes),
            attempts=0,
            is_used=False,
            created_at=now - timedelta(seconds=70),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record.id
    finally:
        db.close()


def _cleanup_test_otps(email: str):
    """Remove OTP records for the configured admin in the development DB."""
    db = SessionLocal()
    try:
        db.query(EmailLoginOTP).filter(
            EmailLoginOTP.email == email
        ).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_verify_valid_otp():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        _create_test_otp(email, "123456")

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "123456"},
        )

        assert response.status_code == 200
        assert response.json()["access_token"]
        assert response.json()["token_type"] == "bearer"
    finally:
        _cleanup_test_otps(email)


def test_incorrect_otp_is_rejected():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        _create_test_otp(email, "123456")

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "999999"},
        )

        assert response.status_code == 401
    finally:
        _cleanup_test_otps(email)


def test_expired_otp_is_rejected():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            record = EmailLoginOTP(
                email=email,
                otp_hash=hash_otp("123456"),
                expires_at=now - timedelta(minutes=1),
                attempts=0,
                is_used=False,
                created_at=now - timedelta(minutes=2),
            )
            db.add(record)
            db.commit()
        finally:
            db.close()

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "123456"},
        )

        assert response.status_code == 401
    finally:
        _cleanup_test_otps(email)


def test_otp_cannot_be_reused():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        _create_test_otp(email, "123456")

        first_response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "123456"},
        )
        assert first_response.status_code == 200

        second_response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "123456"},
        )
        assert second_response.status_code == 401
    finally:
        _cleanup_test_otps(email)


def test_otp_maximum_attempts():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        _create_test_otp(email, "123456")

        for _ in range(settings.otp_max_attempts):
            response = client.post(
                "/api/auth/verify-otp",
                json={"email": email, "otp": "999999"},
            )
            assert response.status_code == 401

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": email, "otp": "123456"},
        )
        assert response.status_code == 401
    finally:
        _cleanup_test_otps(email)


def test_otp_resend_cooldown():
    email = settings.admin_email.strip().lower()
    _cleanup_test_otps(email)

    try:
        with patch("app.services.auth_service.send_otp_email") as mock_send_email:
            first_response = client.post(
                "/api/auth/request-otp",
                json={"email": email},
            )

            assert first_response.status_code == 200
            mock_send_email.assert_called_once()

            second_response = client.post(
                "/api/auth/request-otp",
                json={"email": email},
            )

            assert second_response.status_code == 429
    finally:
        _cleanup_test_otps(email)


def test_jwt_authentication_security():
    """Check missing, invalid, expired, and valid JWT access."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    assert response.status_code == 401

    now = datetime.now(timezone.utc)

    expired_token = jwt.encode(
        {
            "sub": settings.admin_email,
            "role": "MASTER_ADMIN",
            "iat": now - timedelta(minutes=10),
            "exp": now - timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401

    valid_token = jwt.encode(
        {
            "sub": settings.admin_email,
            "role": "MASTER_ADMIN",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 200



def test_master_admin_authorization():
    """Reject a token whose role does not match the user's database role."""
    now = datetime.now(timezone.utc)

    non_admin_token = jwt.encode(
        {
            "sub": settings.admin_email,
            "role": "EDITOR",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(
        "/api/admin/test",
        headers={"Authorization": f"Bearer {non_admin_token}"},
    )

    # The dependency may reject the mismatched role during authentication.
    assert response.status_code in (401, 403)

    admin_token = jwt.encode(
        {
            "sub": settings.admin_email,
            "role": "MASTER_ADMIN",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(
        "/api/admin/test",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
