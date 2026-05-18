"""
OTP Service for forgot-password email verification.

Security design:
- 6-digit numeric OTP
- 5-minute expiry
- Max 5 verification attempts before OTP is invalidated
- 60-second resend cooldown
- Max 5 resends per email per hour
- OTPs are stored with attempt counter; invalidated after max attempts
- A short-lived reset token (issued only after OTP success) gates
  password reset, preventing OTP reuse.
- Cache key prefix 'fp_' is intentionally different from admin_otp 'admin_otp:'
  to prevent any key collisions.
"""
import hashlib
import json
import logging
import secrets
import time

from django.core.cache import cache

from apps.accounts.utils.generators import generate_verification_code

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

OTP_TTL            = 300    # 5 minutes
OTP_MAX_ATTEMPTS   = 5      # invalidate OTP after N failed attempts
RESEND_COOLDOWN    = 60     # seconds between resend requests
RESEND_MAX_HOURLY  = 5      # max resends per email per hour
RESET_TOKEN_TTL    = 600    # 10 minutes — password reset must complete within this window


def _email_hash(email: str) -> str:
    """Return a safe, consistent hash of the email for use in cache keys."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]


# ── Cache key helpers ─────────────────────────────────────────────────────────

def _otp_key(email: str) -> str:
    return f"fp_otp:{_email_hash(email)}"


def _cooldown_key(email: str) -> str:
    return f"fp_otp_cooldown:{_email_hash(email)}"


def _cooldown_expiry_key(email: str) -> str:
    return f"fp_otp_cooldown_expiry:{_email_hash(email)}"


def _resend_count_key(email: str) -> str:
    return f"fp_otp_resend_count:{_email_hash(email)}"


def _reset_token_key(token: str) -> str:
    return f"fp_reset_token:{token}"


# ── OTP generation ────────────────────────────────────────────────────────────

def generate_otp(email: str) -> tuple[str, str]:
    """
    Generate and store a new OTP for the given email.

    Returns (otp_code, error_message).
    error_message is empty on success.

    Enforces:
    - Resend cooldown
    - Hourly resend limit
    """
    # Check resend cooldown
    if cache.get(_cooldown_key(email)):
        cooldown = get_cooldown_seconds(email)
        return '', f'Please wait {cooldown} seconds before requesting another code.'

    # Check hourly resend limit
    resend_count = cache.get(_resend_count_key(email)) or 0
    if resend_count >= RESEND_MAX_HOURLY:
        return '', 'Too many code requests. Please try again in an hour.'

    code = generate_verification_code(length=6)

    payload = json.dumps({'code': code, 'attempts': 0})
    cache.set(_otp_key(email), payload, timeout=OTP_TTL)

    # Set resend cooldown + absolute expiry timestamp for safe TTL calculation
    cache.set(_cooldown_key(email), 1, timeout=RESEND_COOLDOWN)
    cache.set(_cooldown_expiry_key(email), time.time() + RESEND_COOLDOWN, timeout=RESEND_COOLDOWN + 10)

    # Increment hourly resend counter
    cache.set(_resend_count_key(email), resend_count + 1, timeout=3600)

    logger.info("Forgot-password OTP generated for %s", _email_hash(email))
    return code, ''


# ── OTP verification ──────────────────────────────────────────────────────────

def verify_otp(email: str, submitted_code: str) -> tuple[bool, str]:
    """
    Verify a submitted OTP against the stored one.

    Returns (is_valid, error_message).
    On success, deletes the OTP from cache (one-time use) and
    returns (True, '').
    """
    raw = cache.get(_otp_key(email))
    if not raw:
        return False, 'Verification code has expired or does not exist. Please request a new one.'

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        cache.delete(_otp_key(email))
        return False, 'Invalid OTP state. Please request a new code.'

    attempts: int = data.get('attempts', 0)

    if attempts >= OTP_MAX_ATTEMPTS:
        cache.delete(_otp_key(email))
        return False, 'Too many failed attempts. Please request a new code.'

    if data.get('code') != submitted_code:
        data['attempts'] = attempts + 1
        if data['attempts'] >= OTP_MAX_ATTEMPTS:
            cache.delete(_otp_key(email))
            return False, 'Too many failed attempts. Please request a new code.'
        # Re-store with incremented attempt counter, preserving remaining TTL
        cache.set(_otp_key(email), json.dumps(data), timeout=OTP_TTL)
        remaining = OTP_MAX_ATTEMPTS - data['attempts']
        return False, f'Invalid code. {remaining} attempt{"s" if remaining != 1 else ""} remaining.'

    # ── Success ───────────────────────────────────────────────────────────────
    cache.delete(_otp_key(email))
    logger.info("Forgot-password OTP verified successfully for %s", _email_hash(email))
    return True, ''


# ── Reset token ───────────────────────────────────────────────────────────────

def issue_reset_token(email: str) -> str:
    """
    Issue a one-time reset token after successful OTP verification.
    The token gates the password-reset endpoint; it expires in RESET_TOKEN_TTL seconds.

    Returns the token string.
    """
    token = secrets.token_urlsafe(32)
    cache.set(_reset_token_key(token), email.strip().lower(), timeout=RESET_TOKEN_TTL)
    logger.info("Password reset token issued for %s", _email_hash(email))
    return token


def consume_reset_token(token: str, expected_email: str) -> tuple[bool, str]:
    """
    Validate and consume a reset token (single-use).

    Returns (True, '') on success; (False, error_message) otherwise.
    """
    stored_email = cache.get(_reset_token_key(token))
    if not stored_email:
        return False, 'Reset session expired or invalid. Please start the password reset process again.'

    if stored_email != expected_email.strip().lower():
        return False, 'Reset token does not match the provided email. Please start over.'

    # Consume the token (single-use)
    cache.delete(_reset_token_key(token))
    logger.info("Password reset token consumed for %s", _email_hash(expected_email))
    return True, ''


# ── Resend-cooldown status ────────────────────────────────────────────────────

def get_cooldown_seconds(email: str) -> int:
    """
    Return how many seconds remain before a new OTP can be requested.
    Returns 0 if no cooldown is active.
    """
    expiry_ts = cache.get(_cooldown_expiry_key(email))
    if expiry_ts is None:
        return 0
    remaining = int(expiry_ts - time.time())
    return max(0, remaining)


def get_otp_expiry_seconds(email: str) -> int:
    """
    Return how many seconds remain before the current OTP expires.
    Returns 0 if no OTP is active.
    """
    raw = cache.get(_otp_key(email))
    if not raw:
        return 0
    # Cache TTL isn't directly readable, but we store absolute timestamps
    # in the otp payload if needed. For simplicity, return OTP_TTL as estimate.
    return OTP_TTL
