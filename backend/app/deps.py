
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cors.config import settings
from app.cors.database import SessionLocal
from app.models.user import User


bearer_scheme = HTTPBearer(
    scheme_name="JWT Bearer Authentication",
    description="Enter the JWT access token returned after OTP verification.",
    auto_error=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Validate the JWT and load the active user from PostgreSQL."""

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_error

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"leeway": 30},
        )
        subject = payload.get("sub")

        if not isinstance(subject, str) or not subject:
            raise credentials_error

    except JWTError:
        raise credentials_error from None

    user = db.scalar(
        select(User).where(
            User.email == subject,
            User.is_active.is_(True),
        )
    )

    if user is None or payload.get("role") != user.role:
        raise credentials_error

    return user


def require_master_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Restrict an endpoint to an active master administrator."""

    if current_user.role != "MASTER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Master administrator privileges are required.",
        )

    return current_user
