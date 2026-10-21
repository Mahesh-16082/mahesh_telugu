
from pydantic import BaseModel, EmailStr, Field


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )


class OTPRequestResponse(BaseModel):
    message: str
    expires_in_seconds: int


class OTPVerifyResponse(BaseModel):
    message: str
    access_token: str
    token_type: str = "bearer"
