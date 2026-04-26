"""
Log filter to prevent sensitive values from appearing in Django/Gunicorn logs.

Usage — add to settings.LOGGING:

    'filters': {
        'scrub_sensitive': {
            '()': 'apps.common.log_filters.ScrubSensitiveFilter',
        },
    },
"""

import logging
import re

# Matches ?token=<value> or &token=<value> anywhere in a log message.
_TOKEN_RE = re.compile(r'((?:\?|&)token=)[^&\s"\'\\]+', re.IGNORECASE)
_REDACTED = r'\1[REDACTED]'


def _scrub(value: str) -> str:
    return _TOKEN_RE.sub(_REDACTED, value)


class ScrubSensitiveFilter(logging.Filter):
    """
    Removes ?token=<jwt> from logged strings so JWTs never appear in
    stdout/stderr or log files even if the legacy query-param path is hit.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _scrub(record.msg)

        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: _scrub(v) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, (list, tuple)):
                record.args = type(record.args)(
                    _scrub(a) if isinstance(a, str) else a
                    for a in record.args
                )

        return True
