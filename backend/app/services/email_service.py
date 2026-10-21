
import smtplib
from email.message import EmailMessage

from app.cors.config import settings


def send_otp_email(recipient: str, otp: str) -> None:
    """Send a login OTP through the configured SMTP server."""
    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP credentials are not configured.")

    sender = settings.smtp_from_email or settings.smtp_username

    message = EmailMessage()
    message["Subject"] = "Your Telugu Front login code"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        f"""Hello,

Your Telugu Front login code is: {otp}

This code expires in {settings.otp_expire_minutes} minutes.
Do not share this code with anyone.

If you did not request this code, you can ignore this email.

Regards,
Telugu Front
"""
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
