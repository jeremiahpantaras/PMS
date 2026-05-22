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
    Raises ValidationError with a specific message describing the exact problem.
    """
    if not value:
        return  # blank/null handled by field-level blank/null constraints

    # Check for disallowed characters (only digits, spaces, +, (, ) are allowed)
    stripped = re.sub(r'[\s()+]', '', value)
    if re.search(r'[^0-9]', stripped):
        raise ValidationError("Phone number contains invalid characters.")

    digits = _extract_ph_digits(value)

    if not digits.startswith('9'):
        raise ValidationError(
            "Phone number must start with a valid prefix (09 or +63 9)."
        )
    if len(digits) < 10:
        raise ValidationError("Phone number is too short.")
    if len(digits) > 10:
        raise ValidationError("Phone number is too long.")
    if not re.match(r'^9\d{9}$', digits):
        raise ValidationError(
            "Enter a valid Philippine mobile number (e.g. 09XX XXX XXXX)."
        )


def validate_email_detailed(value: str) -> None:
    """
    Validate an email address with specific error messages.
    Raises ValidationError describing exactly what is wrong.
    """
    if not value or not value.strip():
        raise ValidationError("Email is required.")

    if re.search(r'\s', value):
        raise ValidationError("Email must not contain spaces.")

    if '@' not in value:
        raise ValidationError("Email must contain @.")

    at_idx = value.rfind('@')
    local  = value[:at_idx]
    domain = value[at_idx + 1:]

    if not local:
        raise ValidationError("Email must have content before @.")
    if not domain:
        raise ValidationError("Email must have a domain after @.")
    if '.' not in domain:
        raise ValidationError("Email must include a valid domain (e.g. .com).")

    tld = domain.rsplit('.', 1)[-1]
    if len(tld) < 2:
        raise ValidationError("Email domain extension is too short.")

    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value):
        raise ValidationError("Please enter a valid email address.")


def normalize_ph_phone(value: str) -> str:
    """
    Normalize any PH phone input to the canonical storage format: +63XXXXXXXXXX.
    Call this in serializer validate_<field> or model save() before persisting.
    """
    if not value:
        return value

    digits = _extract_ph_digits(value)
    return f'+63{digits}'
