from django import template
from django.conf import settings
import os

register = template.Library()

@register.simple_tag
def get_backend_url():
    """Returns the base URL of the backend, useful for generating absolute URLs in emails."""
    return getattr(settings, 'BACKEND_URL', os.environ.get('BACKEND_URL', 'http://localhost:8000')).rstrip('/')

@register.filter
def format_duration(mins):
    try:
        mins = int(mins)
    except (ValueError, TypeError):
        return mins
    
    if mins == 0:
        return '0 minutes'
    
    h = mins // 60
    m = mins % 60
    
    if h == 0:
        return f"{m} minute{'s' if m != 1 else ''}"
    
    h_str = f"{h} hour{'s' if h != 1 else ''}"
    if m == 0:
        return h_str
        
    m_str = f"{m} minute{'s' if m != 1 else ''}"
    return f"{h_str} {m_str}"
