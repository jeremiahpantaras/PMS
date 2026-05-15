"""
Google reCAPTCHA v2 verification utility.

Usage:
    from apps.common.recaptcha import verify_recaptcha

    ok, error = verify_recaptcha(token, remote_ip)
    if not ok:
        return Response({'detail': error}, status=400)
"""
import logging
import urllib.request
import urllib.parse
import json
from django.conf import settings

logger = logging.getLogger(__name__)

RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_recaptcha(token: str, remote_ip: str = '') -> tuple[bool, str]:
    """
    Verify a reCAPTCHA v2 response token with Google's API.

    Args:
        token:     The g-recaptcha-response value submitted by the client.
        remote_ip: Optional – the user's IP address (sent to Google for scoring).

    Returns:
        (True, '')         on success
        (False, message)   on failure
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')

    # In test/dev environments without a secret key configured, skip validation
    if not secret:
        logger.warning(
            "RECAPTCHA_SECRET_KEY is not set — skipping reCAPTCHA verification. "
            "Set this variable in production."
        )
        return True, ''

    if not token:
        return False, 'reCAPTCHA verification is required.'

    try:
        payload = urllib.parse.urlencode({
            'secret':   secret,
            'response': token,
            **(({'remoteip': remote_ip}) if remote_ip else {}),
        }).encode()

        req = urllib.request.Request(
            RECAPTCHA_VERIFY_URL,
            data=payload,
            method='POST',
        )
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')

        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode())

        if result.get('success'):
            return True, ''

        error_codes = result.get('error-codes', [])
        logger.warning(f"reCAPTCHA verification failed: {error_codes}")

        # Map Google error codes to user-friendly messages
        if 'timeout-or-duplicate' in error_codes:
            return False, 'reCAPTCHA has expired. Please complete the verification again.'
        if 'invalid-input-response' in error_codes:
            return False, 'Invalid reCAPTCHA response. Please try again.'

        return False, 'reCAPTCHA verification failed. Please try again.'

    except Exception as exc:
        logger.error(f"reCAPTCHA verification error: {exc}")
        # Fail open only in non-production; in production treat errors as failures
        if getattr(settings, 'DEBUG', False):
            logger.warning("DEBUG mode: allowing request despite reCAPTCHA error.")
            return True, ''
        return False, 'Could not verify reCAPTCHA. Please try again.'
