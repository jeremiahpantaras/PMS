import re
from django.core.exceptions import ValidationError


import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

def validate_international_phone(value: str) -> None:
    """
    Validate that *value* is a valid international phone number.
    Raises ValidationError if invalid.
    """
    if not value:
        return  # blank/null handled by field-level constraints

    try:
        # Default to 'PH' region if no '+' is provided, but allow any valid international number
        parsed = phonenumbers.parse(value, "PH")
        if not phonenumbers.is_possible_number(parsed):
            raise ValidationError("Please enter a valid phone number.")
    except NumberParseException:
        raise ValidationError("Please enter a valid phone number format (e.g. +639XXXXXXXXX).")


def normalize_international_phone(value: str) -> str:
    """
    Normalize any phone input to the canonical E.164 storage format: +<CountryCode><NationalNumber>.
    Call this in serializer validate_<field> or model save() before persisting.
    """
    if not value:
        return value

    try:
        parsed = phonenumbers.parse(value, "PH")
        if phonenumbers.is_possible_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except NumberParseException:
        pass
    
    return value  # Fallback to original if parsing fails, though validation should catch it first


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
