import re
from django.core.exceptions import ValidationError


def _extract_ph_digits(value: str) -> str:
    """Strip formatting and remove leading 0 or +63/63 prefix."""
    digits = re.sub(r'\D', '', value)
    if digits.startswith('0'):
        digits = digits[1:]
    if digits.startswith('63'):
        digits = digits[2:]
    return digits


def validate_ph_phone(value: str) -> None:
    """
    Validate that *value* is a valid Philippine mobile number.
    Accepts any common format: 09XXXXXXXXX, +639XXXXXXXXX, (63) 9XX XXX XXXX, etc.
    Raises ValidationError if invalid.
    """
    if not value:
        return  # blank/null handled by field-level blank/null constraints

    digits = _extract_ph_digits(value)

    if not re.match(r'^9\d{9}$', digits):
        raise ValidationError(
            "Enter a valid Philippine mobile number (e.g. 09XX XXX XXXX)."
        )


def normalize_ph_phone(value: str) -> str:
    """
    Normalize any PH phone input to the canonical storage format: +63XXXXXXXXXX.
    Call this in serializer validate_<field> or model save() before persisting.
    """
    if not value:
        return value

    digits = _extract_ph_digits(value)
    return f'+63{digits}'
