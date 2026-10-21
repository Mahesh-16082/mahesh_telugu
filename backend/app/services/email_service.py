
import smtplib
from email.message import EmailMessage
from html import escape

from app.cors.config import settings


def send_otp_email(recipient: str, otp: str) -> None:
    """Send a branded HTML login OTP email through SMTP."""

    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP credentials are not configured.")

    sender = settings.smtp_from_email or settings.smtp_username
    expiry_minutes = settings.otp_expire_minutes

    # Escape dynamic values before inserting them into HTML.
    safe_otp = escape(str(otp))
    safe_expiry = escape(str(expiry_minutes))

    message = EmailMessage()
    message["Subject"] = "Your Telugu Front Admin Portal OTP"
    message["From"] = sender
    message["To"] = recipient

    # Plain-text fallback for email clients that do not support HTML.
    text_body = f"""Telugu Front
Admin Portal Login

Use the following OTP to sign in to your Telugu Front Admin Portal.

Your OTP: {otp}

This OTP expires in {expiry_minutes} minutes.
Do not share this OTP with anyone.

If you did not request this login, you can safely ignore this email.

Telugu Front Admin Portal
"""

    message.set_content(text_body)

    # HTML email styled like the provided admin portal email design.
    html_body = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telugu Front Admin Portal OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fa;
             font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       border="0" style="background-color:#f3f6fa;padding:22px 10px;">
    <tr>
        <td align="center">

            <table role="presentation" width="100%" cellpadding="0"
                   cellspacing="0" border="0"
                   style="max-width:370px;background-color:#ffffff;
                          border:1px solid #e1e7ef;border-radius:14px;
                          overflow:hidden;">

                <!-- Dark teal header -->
                <tr>
                    <td style="background-color:#073442;padding:20px 22px;
                               color:#ffffff;">
                        <div style="font-size:21px;font-weight:bold;
                                    color:#ff3548;margin-bottom:12px;">
                            Telugu Front
                        </div>

                        <div style="font-size:16px;font-weight:bold;
                                    margin-bottom:7px;">
                            Admin Portal Login
                        </div>

                        <div style="font-size:10px;color:#d4e2e8;">
                            Secure newsroom sign-in verification
                        </div>
                    </td>
                </tr>

                <!-- Main content -->
                <tr>
                    <td style="padding:22px 21px 20px;color:#344054;">

                        <p style="font-size:11px;line-height:1.7;
                                  margin:0 0 17px;">
                            Use the following OTP to sign in to your
                            Telugu Front Admin Portal.
                        </p>

                        <!-- Red OTP box -->
                        <table role="presentation" width="100%"
                               cellpadding="0" cellspacing="0" border="0"
                               style="background-color:#fff1f2;
                                      border:1px solid #fecdd3;
                                      border-radius:9px;">
                            <tr>
                                <td align="center"
                                    style="padding:14px 8px;color:#c8103e;
                                           font-size:27px;font-weight:bold;
                                           letter-spacing:7px;">
                                    {safe_otp}
                                </td>
                            </tr>
                        </table>

                        <p style="font-size:10px;line-height:1.7;
                                  margin:18px 0 10px;">
                            This OTP expires in
                            <strong>{safe_expiry} minutes.</strong>
                        </p>

                        <p style="font-size:10px;line-height:1.8;
                                  color:#64748b;margin:0 0 10px;">
                            Do not share this OTP with anyone.
                            Telugu Front staff will never ask you for
                            your login verification code.
                        </p>

                        <p style="font-size:10px;line-height:1.8;
                                  color:#64748b;margin:0;">
                            If you did not request this login, you can
                            safely ignore this email.
                        </p>

                    </td>
                </tr>

                <!-- Light footer -->
                <tr>
                    <td align="center"
                        style="background-color:#f8fafc;
                               border-top:1px solid #e2e8f0;
                               padding:13px 10px;color:#8291a7;
                               font-size:9px;">
                        Telugu Front Admin Portal
                    </td>
                </tr>

            </table>

        </td>
    </tr>
</table>

</body>
</html>
"""

    message.add_alternative(html_body, subtype="html")

    # Keep the existing SMTP delivery configuration.
    with smtplib.SMTP(
        settings.smtp_host,
        settings.smtp_port,
        timeout=15,
    ) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(
            settings.smtp_username,
            settings.smtp_password,
        )
        server.send_message(message)
