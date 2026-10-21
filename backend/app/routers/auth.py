
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas.auth_otp import (
    OTPRequest,
    OTPRequestResponse,
    OTPVerify,
    OTPVerifyResponse,
)
from app.services.auth_service import (
    request_login_otp,
    verify_login_otp,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/request-otp", response_model=OTPRequestResponse)
def request_otp(
    payload: OTPRequest,
    db: Session = Depends(get_db),
):
    try:
        return request_login_otp(payload.email, db)
    except ValueError as exc:
        message = str(exc)

        if message.startswith("Please wait"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message,
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        ) from exc
    except Exception as exc:
        # Do not expose SMTP credentials or internal exception details.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send the login code. Please try again later.",
        ) from exc


@router.post("/verify-otp", response_model=OTPVerifyResponse)
def verify_otp(
    payload: OTPVerify,
    db: Session = Depends(get_db),
):
    try:
        return verify_login_otp(payload.email, payload.otp, db)
    except ValueError as exc:
        message = str(exc)

        if message.startswith("Please wait"):
            code = status.HTTP_429_TOO_MANY_REQUESTS
        else:
            code = status.HTTP_401_UNAUTHORIZED

        raise HTTPException(
            status_code=code,
            detail=message,
        ) from exc
