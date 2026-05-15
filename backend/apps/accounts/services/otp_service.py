"""
OTP Service for admin registration email verification.

Security design:
- 6-digit numeric OTP
- 5-minute expiry
- Max 5 verification attempts before OTP is invalidated
- 60-second resend cooldown
- Max 5 resends per email per hour
- OTPs are stored with attempt counter; invalidated after max attempts
- A short-lived verification token (issued only after OTP success) gates
  account creation, preventing OTP reuse.
"""
import hashlib
import json
import logging
import secrets
import time
from django.core.cache import cache
from django.utils import timezone
from apps.accounts.utils.generators import generate_verification_code

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

OTP_TTL            = 300      # 5 minutes
OTP_MAX_ATTEMPTS   = 5        # invalidate OTP after N failed attempts
RESEND_COOLDOWN    = 60       # seconds between resend requests
RESEND_MAX_HOURLY  = 5        # max resends per email per hour
VERIFY_TOKEN_TTL   = 600      # 10 minutes — registration must complete within this window


def _email_hash(email: str) -> str:
    """Return a safe, consistent hash of the email for use in cache keys."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]


# ── Cache key helpers ─────────────────────────────────────────────────────────

def _otp_key(email: str) -> str:
    return f"admin_otp:{_email_hash(email)}"


def _cooldown_key(email: str) -> str:
    return f"admin_otp_cooldown:{_email_hash(email)}"


def _cooldown_expiry_key(email: str) -> str:
    return f"admin_otp_cooldown_expiry:{_email_hash(email)}"


def _resend_count_key(email: str) -> str:
    return f"admin_otp_resend_count:{_email_hash(email)}"


def _verified_token_key(token: str) -> str:
    return f"admin_otp_verified:{token}"


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
    # Check cooldown
    if cache.get(_cooldown_key(email)):
        return '', 'Please wait before requesting another code.'

    # Check hourly resend limit
    resend_count = cache.get(_resend_count_key(email)) or 0
    if resend_count >= RESEND_MAX_HOURLY:
        return '', 'Too many verification requests. Please try again in an hour.'

    code = generate_verification_code(length=6)

    payload = json.dumps({
        'code': code,
        'attempts': 0,
    })
    cache.set(_otp_key(email), payload, timeout=OTP_TTL)

    # Set resend cooldown + store absolute expiry timestamp for safe TTL calculation
    cache.set(_cooldown_key(email), 1, timeout=RESEND_COOLDOWN)
    cache.set(_cooldown_expiry_key(email), time.time() + RESEND_COOLDOWN, timeout=RESEND_COOLDOWN + 10)

    # Increment hourly resend counter
    cache.set(_resend_count_key(email), resend_count + 1, timeout=3600)

    logger.info(f"Admin OTP generated for {_email_hash(email)}")
    return code, ''


# ── OTP verification ──────────────────────────────────────────────────────────

def verify_otp(email: str, submitted_code: str) -> tuple[bool, str]:
    """
    Verify a submitted OTP against the stored one.

    Returns (is_valid, error_message).
    On success, deletes the OTP from cache (one-time use) and
    returns a blank error message.
    """
    raw = cache.get(_otp_key(email))
    if not raw:
        return False, 'Verification code has expired. Please request a new one.'

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        cache.delete(_otp_key(email))
        return False, 'Verification code is invalid. Please request a new one.'

    attempts: int = data.get('attempts', 0)

    if attempts >= OTP_MAX_ATTEMPTS:
        cache.delete(_otp_key(email))
        return False, 'Too many failed attempts. Please request a new code.'

    # Constant-time comparison to resist timing attacks
    if not secrets.compare_digest(str(data.get('code', '')), str(submitted_code).strip()):
        # Increment attempt counter and re-store
        data['attempts'] = attempts + 1
        # Use remaining TTL — keep original expiry; approximate with full TTL on update
        cache.set(_otp_key(email), json.dumps(data), timeout=OTP_TTL)
        remaining = OTP_MAX_ATTEMPTS - data['attempts']
        if remaining > 0:
            return False, f'Invalid code. {remaining} attempt(s) remaining.'
        # Max attempts reached — invalidate
        cache.delete(_otp_key(email))
        return False, 'Too many failed attempts. Please request a new code.'

    # ✅ Code is correct — delete immediately (one-time use)
    cache.delete(_otp_key(email))
    logger.info(f"Admin OTP verified successfully for {_email_hash(email)}")
    return True, ''


# ── Verification token ────────────────────────────────────────────────────────

def issue_verification_token(email: str) -> str:
    """
    Issue a short-lived opaque token that gates account creation.
    This is given to the client after OTP verification succeeds;
    the client must present it with the register-admin request.
    """
    token = secrets.token_urlsafe(32)
    cache.set(_verified_token_key(token), email.strip().lower(), timeout=VERIFY_TOKEN_TTL)
    logger.info(f"Registration verification token issued for {_email_hash(email)}")
    return token


def consume_verification_token(token: str, expected_email: str) -> tuple[bool, str]:
    """
    Validate and consume (delete) a verification token.
    The email in the token must match expected_email.

    Returns (is_valid, error_message).
    """
    if not token:
        return False, 'Email verification token is required.'

    stored_email = cache.get(_verified_token_key(token))
    if not stored_email:
        return False, 'Verification token has expired or is invalid. Please verify your email again.'

    if stored_email != expected_email.strip().lower():
        return False, 'Verification token does not match the provided email.'

    # Consume (one-time use)
    cache.delete(_verified_token_key(token))
    logger.info(f"Registration token consumed for {_email_hash(expected_email)}")
    return True, ''


# ── Resend-cooldown status ────────────────────────────────────────────────────

def get_cooldown_seconds(email: str) -> int:
    """
    Return remaining cooldown seconds (0 if no cooldown active).

    Uses a stored expiry timestamp instead of cache.ttl() so that this works
    with Django's standard RedisCache backend (which does not expose ttl())
    as well as LocMemCache, Render Redis, and any other Django cache backend.
    """
    try:
        expiry = cache.get(_cooldown_expiry_key(email))
        if expiry is None:
            return 0
        remaining = expiry - time.time()
        return max(0, int(remaining))
    except Exception:
        logger.exception("get_cooldown_seconds: failed to read cooldown expiry from cache")
        return 0
