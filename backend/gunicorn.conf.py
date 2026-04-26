"""
Gunicorn configuration for Render + Django Channels (ASGI).

Start command (Render dashboard → Start Command):
    gunicorn config.asgi:application -c gunicorn.conf.py

Why Gunicorn + UvicornWorker instead of bare Daphne?
- Each *process* worker has its own isolated connection space.
- Worker count is deterministic, so max DB connections are predictable:
      max_connections = workers × peak_concurrent_db_calls
- With CONN_MAX_AGE=0 every request's connection is released immediately.
- Django Channels WebSockets work identically with UvicornWorker.

Connection budget for a small Render PostgreSQL plan (≈25 connections):
    workers=2 → comfortable headroom even under burst traffic.
    Raise to 3 only if you upgrade to a larger DB plan.
"""

import os

# ── Worker count ──────────────────────────────────────────────────────────────
# Keep this LOW on small Render plans to cap PostgreSQL connections.
# Formula: workers = (2 × CPU cores) + 1  but capped at 2–3 for a free/starter DB.
# Override via WEB_CONCURRENCY env var in the Render dashboard if you scale up.
workers = int(os.getenv("WEB_CONCURRENCY", "2"))

# UvicornWorker supports ASGI, Django Channels WebSockets, and async views.
worker_class = "uvicorn.workers.UvicornWorker"

# ── Bind ──────────────────────────────────────────────────────────────────────
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# ── Timeouts ─────────────────────────────────────────────────────────────────
# Long-running requests (file uploads, reports) need > 30 s default.
timeout = 120

# How long a silent keep-alive connection is kept open between requests.
keepalive = 5

# Time to finish in-flight requests after a graceful SIGTERM.
graceful_timeout = 30

# ── Logging ──────────────────────────────────────────────────────────────────
accesslog = "-"   # stdout → visible in Render logs
errorlog  = "-"   # stderr → visible in Render logs
loglevel  = "info"

# Use %(U)s (path only, no query string) instead of %(r)s (full request line)
# to prevent JWT tokens from being written to access logs when the legacy
# ?token= query-param path is used. All other useful fields are preserved.
# Format: IP - user [timestamp] "METHOD /path HTTP/ver" status bytes ref agent
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(m)s %(U)s %(H)s" %(s)s %(b)s "%(f)s" "%(a)s"'
)

# ── Worker recycling ─────────────────────────────────────────────────────────
# Restart a worker after it has served this many requests.
# Prevents slow memory leaks from accumulating over long deployments.
max_requests = 1000
max_requests_jitter = 100   # Randomise so workers don't all restart at once
