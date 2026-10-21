
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cors.config import settings
from app.cors.security import (
    create_access_token,
    generate_otp,
    hash_otp,
    verify_otp_hash,
)
from app.models.email_login_otp import EmailLoginOTP
from app.models.user import User
from app.schemas.auth_otp import OTPRequestResponse, OTPVerifyResponse
from app.services.email_service import send_otp_email


def _utc(value: datetime) -> datetime:
    """Normalize database datetimes to timezone-aware UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def request_login_otp(email: str, db: Session) -> OTPRequestResponse:
    """Create and email an OTP for the configured administrator."""
    normalized_email = email.strip().lower()
    admin_email = settings.admin_email.strip().lower()

    if normalized_email != admin_email:
        raise ValueError("Unable to process login request for this email.")

    try:
        # Lock the user row to serialize OTP requests for this account.
        user = db.scalar(
            select(User)
            .where(
                User.email == normalized_email,
                User.is_active.is_(True),
            )
            .with_for_update()
        )

        if user is None:
            db.rollback()
            raise ValueError("The administrator account is not available.")

        now = datetime.now(timezone.utc)

        # Include used OTPs so successful verification does not bypass cooldown.
        latest_otp = db.scalar(
            select(EmailLoginOTP)
            .where(EmailLoginOTP.email == normalized_email)
            .order_by(EmailLoginOTP.created_at.desc(), EmailLoginOTP.id.desc())
            .limit(1)
        )

        if latest_otp is not None:
            elapsed = (now - _utc(latest_otp.created_at)).total_seconds()
            remaining = settings.otp_resend_cooldown_seconds - elapsed

            if remaining > 0:
                db.rollback()
                raise ValueError(
                    f"Please wait {int(remaining) + 1} seconds "
                    "before requesting another OTP."
                )

        # Invalidate every previous unused OTP before creating a new one.
        previous_otps = db.scalars(
            select(EmailLoginOTP)
            .where(
                EmailLoginOTP.email == normalized_email,
                EmailLoginOTP.is_used.is_(False),
            )
            .with_for_update()
        ).all()

        for previous in previous_otps:
            previous.is_used = True

        otp = generate_otp()
        otp_record = EmailLoginOTP(
            email=normalized_email,
            otp_hash=hash_otp(otp),
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
            attempts=0,
            is_used=False,
            created_at=now,
        )
        db.add(otp_record)
        db.commit()

    except ValueError:
        raise
    except Exception:
        db.rollback()
        raise

    # Email sending happens after the database transaction commits.
    try:
        send_otp_email(normalized_email, otp)
    except Exception:
        # Prevent an OTP from remaining usable if email delivery fails.
        try:
            record = db.get(EmailLoginOTP, otp_record.id)
            if record is not None:
                record.is_used = True
                db.commit()
        except Exception:
            db.rollback()
        raise RuntimeError("Unable to send the login code. Please try again later.")

    return OTPRequestResponse(
        message="If the account is eligible, a login code has been sent.",
        expires_in_seconds=settings.otp_expire_minutes * 60,
    )


def verify_login_otp(
    email: str,
    otp: str,
    db: Session,
) -> OTPVerifyResponse:
    """Verify an OTP and issue a JWT once the code is valid."""
    normalized_email = email.strip().lower()
    admin_email = settings.admin_email.strip().lower()

    if normalized_email != admin_email:
        raise ValueError("Invalid or expired OTP.")

    try:
        # Lock the account row first, matching the request flow's lock order.
        user = db.scalar(
            select(User)
            .where(
                User.email == normalized_email,
                User.is_active.is_(True),
            )
            .with_for_update()
        )

        if user is None:
            db.rollback()
            raise ValueError("Invalid or expired OTP.")

        otp_record = db.scalar(
            select(EmailLoginOTP)
            .where(
                EmailLoginOTP.email == normalized_email,
                EmailLoginOTP.is_used.is_(False),
            )
            .order_by(EmailLoginOTP.created_at.desc(), EmailLoginOTP.id.desc())
            .limit(1)
            .with_for_update()
        )

        if otp_record is None:
            db.rollback()
            raise ValueError("Invalid or expired OTP.")

        now = datetime.now(timezone.utc)

        if _utc(otp_record.expires_at) <= now:
            otp_record.is_used = True
            db.commit()
            raise ValueError("Invalid or expired OTP.")

        if otp_record.attempts >= settings.otp_max_attempts:
            otp_record.is_used = True
            db.commit()
            raise ValueError(
                "Maximum verification attempts exceeded. Request a new OTP."
            )

        if not verify_otp_hash(otp, otp_record.otp_hash):
            otp_record.attempts += 1

            if otp_record.attempts >= settings.otp_max_attempts:
                otp_record.is_used = True

            db.commit()
            raise ValueError("Invalid or expired OTP.")

        # Consume the OTP before issuing the access token.
        otp_record.is_used = True
        db.commit()

        token = create_access_token(
            subject=user.email,
            role=user.role,
        )

        return OTPVerifyResponse(
            message="Login successful.",
            access_token=token,
            token_type="bearer",
        )

    except ValueError:
        raise
    except Exception:
        db.rollback()
        raise
