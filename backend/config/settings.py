from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url
import cloudinary



# Load environment variables
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Security Settings
SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "False") == "True"

# Timezone
TIME_ZONE = 'Asia/Manila'
USE_TZ = True

# Frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# reCAPTCHA
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")

# Allowed Hosts
if os.getenv("RENDER"):
    ALLOWED_HOSTS = ["mespms.com", "www.mespms.com", "api.mespms.com", "malasakit-webservice.onrender.com",]
else:
    ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'daphne',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'cloudinary',
    'cloudinary_storage',
    'django_crontab',
    'django_celery_beat',
    'channels',         # ← already present

    # Your apps
    'apps.common',
    'apps.accounts',
    'apps.clinics',
    'apps.clinics.services',
    'apps.patients',
    'apps.appointments',
    'apps.records',
    'apps.billing',
    'apps.reports',
    'apps.contacts',
    'apps.notifications',
    'apps.integrations',
    'apps.clinical_templates',
    'apps.inventory',
    'apps.messages',
    'apps.subscriptions',
]

# ── Django Channels ───────────────────────────────────────────────────────────
ASGI_APPLICATION = 'config.asgi.application'

if DEBUG:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [os.getenv('REDIS_URL', 'redis://127.0.0.1:6379')],
            },
        },
    }

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.subscriptions.middleware.SubscriptionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Cache Settings
# Use Redis in production (REDIS_URL set by Render), LocMem in local dev.
_redis_url = os.getenv('REDIS_URL')
if _redis_url:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _redis_url,
            'OPTIONS': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
            },
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }

# ── Celery ───────────────────────────────────────────────────────────────────
# Use Redis if available (production); fall back to in-memory transport for local dev.
_celery_broker = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
CELERY_BROKER_URL        = _celery_broker
CELERY_RESULT_BACKEND    = _celery_broker
CELERY_ACCEPT_CONTENT    = ['json']
CELERY_TASK_SERIALIZER   = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE          = 'Asia/Manila'
CELERY_ENABLE_UTC        = True

from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    # 8:00 AM Asia/Manila (Since CELERY_TIMEZONE is Asia/Manila, we use local hour=8)
    'send-appointment-reminders-daily': {
        'task': 'apps.appointments.tasks.send_appointment_reminders_task',
        'schedule': crontab(hour=8, minute=0),
    },
}

# ── PayMongo ──────────────────────────────────────────────────────────────────
# SECRET_KEY is backend-only. PUBLIC_KEY is safe to use in the backend too.
# NEVER expose PAYMONGO_SECRET_KEY or PAYMONGO_WEBHOOK_SECRET to the frontend.
PAYMONGO_PUBLIC_KEY = os.getenv('PAYMONGO_PUBLIC_KEY', '')
PAYMONGO_SECRET_KEY = os.getenv('PAYMONGO_SECRET_KEY', '')
PAYMONGO_WEBHOOK_SECRET = os.getenv('PAYMONGO_WEBHOOK_SECRET', '')
SUBSCRIPTION_PRICE = int(os.getenv('SUBSCRIPTION_PRICE', 39900))   # centavos ₱399
SUBSCRIPTION_DAYS = int(os.getenv('SUBSCRIPTION_DAYS', 30))
TRIAL_DAYS = int(os.getenv('TRIAL_DAYS', 14))

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://malasakit.cosedevs.com",
    "https://malasakit.com",
]

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.getenv('CLOUDINARY_CLOUD_NAME', ''),
    'API_KEY': os.getenv('CLOUDINARY_API_KEY', ''),
    'API_SECRET': os.getenv('CLOUDINARY_API_SECRET', ''),
}



# Add production frontend URL dynamically
if not DEBUG:
    CORS_ALLOWED_ORIGINS += [
        os.getenv('FRONTEND_URL', 'https://malasakit.cosedevs.com'),
        'https://www.mespms.com',
    ]

CORS_ALLOW_CREDENTIALS = True

ROOT_URLCONF = 'config.urls'

CRONJOBS = [
    # Every day at 8:00 AM Asia/Manila — send reminders for tomorrow's appointments
    ('0 8 * * *', 'config.cron.send_reminders_cron'),
    # Every day at 8:00 AM — send Y/N communication reminders (clinic-configurable timing)
    ('0 8 * * *', 'config.cron.send_communication_reminders_cron'),
    # Every 2 hours — send DNA follow-ups for missed/declined appointments
    ('0 */2 * * *', 'config.cron.send_dna_followups_cron'),
    # Every day at 10:00 AM — send no-rebook follow-ups (delayed outreach)
    ('0 10 * * *', 'config.cron.send_rebook_followups_cron'),
    # Every Monday at 9:00 AM — send inactive patient wellness check-ins
    ('0 9 * * 1', 'config.cron.send_inactive_checkins_cron'),
    # Every hour — expire subscriptions that passed end_date
    ('0 * * * *', 'config.cron.expire_subscriptions'),
    # Every day at 2:00 AM — rotate passwords for users with a rotation schedule
    ('0 2 * * *', 'config.cron.rotate_passwords_cron'),
]


TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

#DATABASE
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Production (Render PostgreSQL)
    # IMPORTANT: CONN_MAX_AGE must be 0 for ASGI servers (Daphne / uvicorn).
    # Persistent connections (CONN_MAX_AGE > 0) are designed for WSGI's
    # thread-per-request model.  Under ASGI each async task/coroutine can open
    # its own connection and Django never reliably closes them, so the pool
    # fills up and you get "remaining connection slots are reserved for
    # roles with the SUPERUSER attribute".
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=0,       # Close connections after every request (ASGI-safe)
            ssl_require=True,
        )
    }
    # Verify a stored connection is still alive before reusing it.
    DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
    # TCP keepalive / connect timeout so stale connections are detected fast.
    DATABASES["default"].setdefault("OPTIONS", {}).update({
        "connect_timeout": 10,       # Fail fast instead of hanging
        "keepalives": 1,
        "keepalives_idle": 30,       # Send first probe after 30 s of inactivity
        "keepalives_interval": 10,   # Retry every 10 s
        "keepalives_count": 5,       # Give up after 5 failed probes
    })
else:
    # Local development
    DATABASES = {
        'default': {
            'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
            'NAME': os.getenv('DB_NAME', 'pms_DB'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'CONN_MAX_AGE': 0,       # Keep consistent with production behaviour
            'CONN_HEALTH_CHECKS': True,
        }
    }

# ✅ ADD: Field-Level Encryption Key (after EMAIL settings)
FIELD_ENCRYPTION_KEY = os.getenv('FIELD_ENCRYPTION_KEY')

if not FIELD_ENCRYPTION_KEY:
    # Generate a temporary key for development ONLY
    # In production, this MUST be set via environment variable
    if DEBUG:
        from cryptography.fernet import Fernet
        FIELD_ENCRYPTION_KEY = Fernet.generate_key()
        print('⚠️  WARNING: Using auto-generated encryption key. Set FIELD_ENCRYPTION_KEY in production!')
    else:
        raise ValueError('FIELD_ENCRYPTION_KEY must be set in production environment')

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

AUTHENTICATION_BACKENDS = [
    'apps.accounts.backend.EmailBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),      # matches inactivity timeout; silent refresh on 401
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',  # Important: Use 'id' not 'username'
    'USER_ID_CLAIM': 'user_id',
    
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    
    'JTI_CLAIM': 'jti',
    
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}

# Email Settings
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Malasakit Team <noreply@malasakit.ph>')

# ── Twilio SMS Settings ───────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID      = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN       = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER      = os.getenv('TWILIO_FROM_NUMBER', '')   
SMS_REMINDERS_ENABLED   = os.getenv('SMS_REMINDERS_ENABLED', 'False') == 'True'

# Cloudinary Settings
CLOUDINARY_URL = os.getenv('CLOUDINARY_URL')

# Django 5+ storage configuration
if DEBUG:
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
else:
    STORAGES = {
        'default': {
            'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }

# Cloudinary static files (optional, for delivering static assets via Cloudinary)
# STORAGES['staticfiles'] = {
#     'BACKEND': 'cloudinary_storage.storage.StaticHashedCloudinaryStorage'
# }

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Internationalization
LANGUAGE_CODE = 'en-us'
USE_I18N = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Security Settings (Production)
if not DEBUG:
    # Trust the X-Forwarded-Proto header from the proxy (Render)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        # Strip ?token=<jwt> from log messages so tokens never appear in logs
        # even if the legacy query-param path is hit (e.g. during DEBUG mode).
        'scrub_sensitive': {
            '()': 'apps.common.log_filters.ScrubSensitiveFilter',
        },
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/django.log'),
            'formatter': 'verbose',
            'filters': ['scrub_sensitive'],
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['scrub_sensitive'],
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'apps': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Create logs directory if it doesn't exist
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)