"""
Two-factor authentication (TOTP).

Every account on the portal must carry an authenticator app. Login is two steps:
password gets you a short-lived CHALLENGE token that opens nothing except the
enrolment/verification endpoints; only a verified 6-digit code mints the real
session token.
"""

import base64
import io
from typing import Optional

import pyotp
import qrcode

ISSUER = "Strat Edge Portal"

# How many 30s steps either side of now are accepted (clock drift on phones).
VALID_WINDOW = 1


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def verify_code(secret: Optional[str], code: Optional[str]) -> bool:
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit():
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=VALID_WINDOW)


def qr_data_uri(uri: str) -> str:
    """PNG data URI of the otpauth:// URI, so the frontend needs no QR library."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
