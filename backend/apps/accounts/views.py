import re
import secrets
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
from .models import User, Role, Permission, PermissionGroup, FeaturePermission, DEFAULT_PERMISSIONS, FEATURE_KEYS, ROLE_PRIORITY, UserRoleChangeLog
from .serializers import (
    UserSerializer, AdminRegistrationSerializer, UserRegistrationSerializer,
    RoleSerializer, PermissionSerializer, PasswordChangeSerializer,
    PermissionGroupSerializer, PermissionGroupWriteSerializer,
)
from .services.password_service import PasswordService
from .services.email_service import EmailService
from .services import otp_service
from .utils.generators import generate_verification_code
from apps.clinics.models import Clinic, Practitioner
from apps.common.permissions import IsAdminOrStaffOnly, HasFeaturePermission
from apps.common.recaptcha import verify_recaptcha
import logging

logger = logging.getLogger(__name__)


class AuthViewSet(viewsets.GenericViewSet):
    """Authentication endpoints"""
    
    permission_classes = [AllowAny]
    
    def get_permissions(self):
        if self.action in [
            'register_admin', 'register', 'login', 'verify_token',
            'forgot_password', 'verify_code', 'reset_password_with_code',
            'send_admin_otp', 'verify_admin_otp',
            # New OTP-based forgot-password flow
            'forgot_password_send_otp', 'forgot_password_verify_otp', 'forgot_password_reset',
            # Admin onboarding — set password without a prior session
            'setup_onboarding_password',
        ]:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    # ── OTP: Step 1 — send verification code ─────────────────────────────────
    @action(detail=False, methods=['post'], url_path='send-admin-otp', permission_classes=[AllowAny])
    def send_admin_otp(self, request):
        """
        Step 1 of admin registration:
        - Validates reCAPTCHA
        - Validates the email is not already registered
        - Sends a 6-digit OTP to the provided email
        """
        email           = (request.data.get('email') or '').strip().lower()
        captcha_token   = request.data.get('captcha_token', '')
        resend          = bool(request.data.get('resend', False))

        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate reCAPTCHA (skip on resend — cooldown already limits abuse)
        if not resend:
            remote_ip = (
                request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
                or request.META.get('REMOTE_ADDR', '')
            )
            captcha_ok, captcha_err = verify_recaptcha(captcha_token, remote_ip)
            if not captcha_ok:
                return Response({'detail': captcha_err}, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicate email
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {'detail': 'An account with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate OTP (enforces cooldown + hourly limit)
        try:
            code, err = otp_service.generate_otp(email)
        except Exception:
            logger.exception("send_admin_otp: unexpected error generating OTP for %s", otp_service._email_hash(email))
            return Response(
                {'detail': 'Unable to send OTP right now. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if err:
            cooldown = otp_service.get_cooldown_seconds(email)
            return Response(
                {'detail': err, 'cooldown_seconds': cooldown},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Build a display name from request data for the email greeting
        first_name = (request.data.get('first_name') or '').strip()
        display_name = first_name if first_name else email

        try:
            email_sent = EmailService.send_admin_otp_email(
                user_email=email,
                user_name=display_name,
                otp_code=code,
            )
        except Exception:
            logger.exception("send_admin_otp: email delivery error for %s", otp_service._email_hash(email))
            email_sent = False

        if not email_sent:
            logger.warning("send_admin_otp: email delivery failed for %s", otp_service._email_hash(email))
            return Response(
                {'detail': 'Failed to send verification code. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {'message': 'Verification code sent.', 'cooldown_seconds': otp_service.RESEND_COOLDOWN},
            status=status.HTTP_200_OK,
        )

    # ── OTP: Step 2 — verify code ─────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='verify-admin-otp', permission_classes=[AllowAny])
    def verify_admin_otp(self, request):
        """
        Step 2 of admin registration:
        - Verifies the OTP submitted by the user
        - On success, issues a short-lived verification token that must
          be included in the subsequent register-admin request.
        """
        email = (request.data.get('email') or '').strip().lower()
        code  = (request.data.get('code') or '').strip()

        if not email or not code:
            return Response(
                {'detail': 'Email and verification code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid, err = otp_service.verify_otp(email, code)
        if not valid:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        token = otp_service.issue_verification_token(email)
        return Response(
            {
                'message': 'Email verified successfully.',
                'verification_token': token,
            },
            status=status.HTTP_200_OK,
        )

    # ── Registration: Step 3 — create account ─────────────────────────────────
    @action(detail=False, methods=['post'], url_path='register-admin', permission_classes=[AllowAny])
    def register_admin(self, request):
        """Register admin — creates clinic + user account and returns a
        short-lived onboarding token.  The admin must exchange this token
        for a JWT by calling setup-onboarding-password with their chosen
        password.  No temporary password is emailed.

        Requires a valid ``verification_token`` issued by verify-admin-otp.
        """
        # ── Consume the OTP verification token ───────────────────────────────
        verification_token = (request.data.get('verification_token') or '').strip()
        email              = (request.data.get('email') or '').strip().lower()

        token_valid, token_err = otp_service.consume_verification_token(verification_token, email)
        if not token_valid:
            return Response({'detail': token_err}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AdminRegistrationSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Internal placeholder password — never sent to the user.
                # The real password is set via setup-onboarding-password.
                internal_password = secrets.token_urlsafe(32)

                # Clinic is created with minimal data — admin fills in the rest
                # during the clinic profile setup step (including clinic email).
                # Admin email is personal only and NOT copied to the clinic.
                clinic = Clinic.objects.create(
                    name=serializer.validated_data['company_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    email='',
                    address='',
                    city='',
                    province='',
                    postal_code='',
                    is_active=True,
                    is_main_branch=True,
                )

                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=internal_password,
                    first_name=serializer.validated_data['first_name'],
                    last_name=serializer.validated_data['last_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    role='ADMIN',
                    roles=['ADMIN'],
                    clinic=clinic,
                    password_changed=False,
                    must_change_password=True,
                )

                # ── Auto-create portal link for the new clinic ───────────────
                from apps.patients.models import PortalLink
                portal_link, _ = PortalLink.get_or_create_for_clinic(clinic)
                logger.info(
                    f"Portal link auto-created for new clinic: {clinic.name} "
                    f"(token: {portal_link.token})"
                )

                # ── Issue single-use onboarding token (30-min TTL) ───────────
                onboarding_token = secrets.token_urlsafe(32)
                cache.set(
                    f'admin_onboarding:{onboarding_token}',
                    user.id,
                    timeout=1800,  # 30 minutes
                )

                logger.info(
                    "Admin onboarding account created for %s (clinic_id=%s, user_id=%s)",
                    user.email, clinic.id, user.id,
                )

                return Response({
                    'message': 'Account created. Please set your password to continue.',
                    'onboarding_token': onboarding_token,
                    'user_email': user.email,
                    'clinic': {'id': clinic.id, 'name': clinic.name},
                    'portal_token': portal_link.token,
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Admin registration failed: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'Registration failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ── Registration: Step 4 — set password & activate ────────────────────────
    @action(detail=False, methods=['post'], url_path='setup-onboarding-password', permission_classes=[AllowAny])
    def setup_onboarding_password(self, request):
        """
        Complete admin onboarding by setting the user's chosen password.

        Consumes the single-use ``onboarding_token`` issued by register-admin,
        validates the new password, activates the account, and returns a JWT
        pair so the admin is logged in immediately.

        No authentication required — the onboarding_token is the proof of
        identity (it is bound to a specific user_id in the cache).
        """
        onboarding_token = (request.data.get('onboarding_token') or '').strip()
        email            = (request.data.get('email') or '').strip().lower()
        new_password     = request.data.get('new_password') or ''

        if not onboarding_token or not email or not new_password:
            return Response(
                {'detail': 'onboarding_token, email, and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate the onboarding token ─────────────────────────────────────
        cache_key = f'admin_onboarding:{onboarding_token}'
        user_id = cache.get(cache_key)
        if not user_id:
            return Response(
                {'detail': 'Onboarding session has expired or is invalid. Please register again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=user_id, email=email)
        except User.DoesNotExist:
            # Token found but email mismatch — consume token to prevent probing
            cache.delete(cache_key)
            return Response(
                {'detail': 'Invalid onboarding session.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate password strength ─────────────────────────────────────────
        strong_pw = re.compile(
            r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'\":\\|,.<>\/?]).{8,}$'
        )
        if not strong_pw.match(new_password):
            return Response(
                {
                    'detail': (
                        'Password must be at least 8 characters and include an uppercase letter, '
                        'a lowercase letter, a number, and a special character.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                # Consume the onboarding token immediately (single-use)
                cache.delete(cache_key)

                user.set_password(new_password)
                user.must_change_password = False
                user.password_changed = True
                user.last_password_change = timezone.now()
                user.temp_password_expires_at = None
                user.save(update_fields=[
                    'password', 'must_change_password', 'password_changed',
                    'last_password_change', 'temp_password_expires_at',
                ])

                refresh = RefreshToken.for_user(user)

                logger.info(
                    "Admin onboarding password set for %s (user_id=%s)",
                    user.email, user.id,
                )

                return Response(
                    {
                        'detail': 'Password set successfully. Welcome!',
                        'user': UserSerializer(user, context={'request': request}).data,
                        'tokens': {
                            'access':  str(refresh.access_token),
                            'refresh': str(refresh),
                        },
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception as e:
            logger.error(
                "setup_onboarding_password failed for %s: %s", user.email, str(e), exc_info=True
            )
            return Response(
                {'detail': 'Password setup failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        """User login."""
        email    = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password')
        
        if not email or not password:
            return Response(
                {'detail': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(request=request, email=email, password=password)
        
        if not user:
            logger.warning(f"Failed login attempt for: {email}")
            return Response(
                {'detail': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'detail': 'Account is inactive. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Reject login when temporary credentials have exceeded their TTL.
        # The user must ask an admin to reset the account.
        if (
            user.must_change_password
            and user.temp_password_expires_at is not None
            and timezone.now() > user.temp_password_expires_at
        ):
            logger.warning(
                "Expired temporary credentials used for %s; login rejected.", user.email
            )
            return Response(
                {
                    'detail': (
                        'Your temporary login credentials have expired. '
                        'Please contact your administrator to have your account reset.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'needs_password_change': user.needs_password_change,
            'must_change_password': user.must_change_password,
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """Blacklist refresh token."""
        try:
            refresh_token = request.data.get('refresh_token')
            if not refresh_token:
                return Response({'detail': 'Refresh token is required'}, status=status.HTTP_400_BAD_REQUEST)
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)
        except TokenError as e:
            return Response({'detail': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': 'Logout failed'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='verify-token', permission_classes=[AllowAny])
    def verify_token(self, request):
        """Verify access token."""
        token = request.data.get('token')
        if not token:
            return Response({'valid': False, 'detail': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            AccessToken(token)
            return Response({'valid': True, 'detail': 'Token is valid'}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({'valid': False, 'detail': 'Token is invalid or expired'}, status=status.HTTP_401_UNAUTHORIZED)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data, status=status.HTTP_200_OK)
    
    @action(
        detail=False,
        methods=['post'],
        url_path='reset-password',
        permission_classes=[IsAuthenticated],
    )
    def reset_password(self, request):
        """
        Self-service password reset:
        1. Generates a new temporary password.
        2. Emails it to the authenticated user's email.
        3. Blacklists the current refresh token → forces re-login.
        4. Sets password_changed=False → prompts change on next login.
        """
        user = request.user

        try:
            with transaction.atomic():
                # 1. Generate + set new password
                new_password = PasswordService.reset_password(user)

                # 2. Blacklist the supplied refresh token (logout current session)
                refresh_token = request.data.get('refresh_token')
                if refresh_token:
                    try:
                        token = RefreshToken(refresh_token)
                        token.blacklist()
                    except TokenError:
                        pass  # already invalid — that's fine

                # 3. Send email with new credentials
                email_sent = EmailService.send_password_reset_email(
                    user_email=user.email,
                    user_name=user.get_full_name(),
                    new_password=new_password,
                )

                if not email_sent:
                    logger.warning(f"Reset email failed for {user.email}")
                    # Still succeed — password was changed, but warn
                    return Response(
                        {
                            'detail': 'Password reset but email delivery failed. '
                                      'Please contact your administrator.',
                            'email_sent': False,
                        },
                        status=status.HTTP_200_OK,
                    )

                logger.info(f"Password reset successful for {user.email}")
                return Response(
                    {
                        'detail': 'Password reset successfully. '
                                  'Check your email for the new temporary password. '
                                  'You will be logged out now.',
                        'email_sent': True,
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            logger.error(f"Password reset failed for {user.email}: {str(e)}")
            return Response(
                {'detail': f'Password reset failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['post'], url_path='forgot-password', permission_classes=[AllowAny])
    def forgot_password(self, request):
        """
        Step 1: Request password reset - send verification code to email.
        """
        email = (request.data.get('email') or '').strip().lower()
        
        if not email:
            return Response(
                {'detail': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            # Don't reveal if email exists or not
            return Response(
                {
                    'message': 'If an account exists with this email, a verification code has been sent.',
                    'code_sent': True
                },
                status=status.HTTP_200_OK
            )
        
        # Generate verification code
        code = generate_verification_code(length=6)
        
        # Store code in cache with 10 minute expiry
        cache_key = f'password_reset_{user.id}'
        cache.set(cache_key, code, timeout=600)  # 10 minutes
        
        # Send email with verification code
        email_sent = EmailService.send_verification_code_email(
            user_email=user.email,
            user_name=user.get_full_name(),
            code=code
        )
        
        if not email_sent:
            logger.warning(f"Verification code email failed for {user.email}")
            return Response(
                {
                    'detail': 'Failed to send verification code. Please try again.',
                    'code_sent': False
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        logger.info(f"Password reset code sent to {user.email}")
        return Response(
            {
                'message': 'If an account exists with this email, a verification code has been sent.',
                'code_sent': True
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='verify-code', permission_classes=[AllowAny])
    def verify_code(self, request):
        """
        Step 2: Verify the code entered by user.
        """
        email = (request.data.get('email') or '').strip().lower()
        code = request.data.get('code')
        
        if not email or not code:
            return Response(
                {'detail': 'Email and code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'valid': False, 'message': 'Invalid verification code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check the code
        cache_key = f'password_reset_{user.id}'
        stored_code = cache.get(cache_key)
        
        if not stored_code:
            return Response(
                {'valid': False, 'message': 'Verification code has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if stored_code != code:
            return Response(
                {'valid': False, 'message': 'Invalid verification code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Code is valid - generate a temporary token for password reset
        temp_token = f"{user.id}_{generate_verification_code(32)}"
        cache.set(f'password_reset_token_{user.id}', temp_token, timeout=300)  # 5 minutes
        
        return Response(
            {'valid': True, 'message': 'Code verified successfully'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='reset-password-with-code', permission_classes=[AllowAny])
    def reset_password_with_code(self, request):
        """
        Step 3: Reset password using verified code.
        After verification, generates a new password and sends it via email.
        """
        email = (request.data.get('email') or '').strip().lower()
        code = request.data.get('code')
        
        if not email or not code:
            return Response(
                {'detail': 'Email and code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Invalid request'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify the code again
        cache_key = f'password_reset_{user.id}'
        stored_code = cache.get(cache_key)
        
        if not stored_code or stored_code != code:
            return Response(
                {'detail': 'Invalid or expired verification code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from datetime import timedelta
        # Generate new password
        new_password = PasswordService.generate_temporary_password()

        # Set new password and enforce first-login change
        user.set_password(new_password)
        user.password_changed        = False
        user.must_change_password    = True
        user.temp_password_expires_at = timezone.now() + timedelta(hours=48)
        user.save(update_fields=[
            'password', 'password_changed', 'must_change_password', 'temp_password_expires_at',
        ])
        
        # Send email with new password
        email_sent = EmailService.send_password_reset_email(
            user_email=user.email,
            user_name=user.get_full_name(),
            new_password=new_password
        )
        
        if not email_sent:
            logger.warning(f"New password email failed for {user.email}")
        
        # Clear the cache
        cache.delete(cache_key)
        
        logger.info(f"Password reset with code successful for {user.email}")
        
        return Response(
            {
                'message': 'Password reset successfully. Check your email for the new password.',
                'password_reset': True
            },
            status=status.HTTP_200_OK
        )

    # ── New OTP-based Forgot Password flow ────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='forgot-password/send-otp', permission_classes=[AllowAny])
    def forgot_password_send_otp(self, request):
        """
        Step 1 of the OTP-based forgot-password flow.
        Accepts an email, silently skips invalid/unknown addresses (prevents
        enumeration), generates a 6-digit OTP, and sends it via email.
        """
        from .services import forgot_password_otp_service as fp_otp

        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Attempt OTP generation — always returns 200 to prevent email enumeration
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            code, err = fp_otp.generate_otp(email)
            if err:
                cooldown = fp_otp.get_cooldown_seconds(email)
                return Response(
                    {'detail': err, 'cooldown_seconds': cooldown},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            try:
                EmailService.send_forgot_password_otp_email(
                    user_email=user.email,
                    user_name=(user.get_full_name() or user.first_name or 'User').strip(),
                    otp_code=code,
                )
            except Exception:
                logger.exception(
                    'forgot_password_send_otp: email delivery failed for %s',
                    fp_otp._email_hash(email),
                )
        else:
            logger.info('forgot_password_send_otp: unknown email %s — silently ignored', fp_otp._email_hash(email))

        # Generic response — never reveal whether the email exists
        return Response(
            {
                'message': 'If an account exists with this email, a verification code has been sent.',
                'expires_in': fp_otp.OTP_TTL,
                'cooldown':   fp_otp.RESEND_COOLDOWN,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='forgot-password/verify-otp', permission_classes=[AllowAny])
    def forgot_password_verify_otp(self, request):
        """
        Step 2 of the OTP-based forgot-password flow.
        Verifies the submitted OTP and, on success, issues a short-lived
        reset token that must be presented to the reset endpoint.
        """
        from .services import forgot_password_otp_service as fp_otp

        email = (request.data.get('email') or '').strip().lower()
        otp   = (request.data.get('otp')   or '').strip()

        if not email or not otp:
            return Response({'detail': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

        valid, err = fp_otp.verify_otp(email, otp)
        if not valid:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        # Confirm account still exists
        if not User.objects.filter(email__iexact=email, is_active=True).exists():
            return Response({'detail': 'Unable to process request.'}, status=status.HTTP_400_BAD_REQUEST)

        reset_token = fp_otp.issue_reset_token(email)
        return Response({'reset_token': reset_token}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='forgot-password/reset', permission_classes=[AllowAny])
    def forgot_password_reset(self, request):
        """
        Step 3 of the OTP-based forgot-password flow.
        Consumes the reset token, validates the new password, resets it,
        and returns a fresh JWT pair (auto-login) on success.
        """
        from .services import forgot_password_otp_service as fp_otp
        from django.contrib.auth.password_validation import validate_password as dj_validate_password
        from django.core.exceptions import ValidationError as DjValidationError
        import re

        email        = (request.data.get('email')        or '').strip().lower()
        reset_token  = (request.data.get('reset_token')  or '').strip()
        new_password =  request.data.get('new_password', '')

        if not email or not reset_token or not new_password:
            return Response(
                {'detail': 'email, reset_token, and new_password are all required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Consume reset token (single-use, 10-minute TTL)
        valid, err = fp_otp.consume_reset_token(reset_token, email)
        if not valid:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Unable to process request.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength via Django validators
        try:
            dj_validate_password(new_password, user=user)
        except DjValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        # Additional strength rules: min 8, upper, lower, digit, special
        strong_pw = re.compile(
            r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?]).{8,}$'
        )
        if not strong_pw.match(new_password):
            return Response(
                {
                    'detail': (
                        'Password must be at least 8 characters and contain an uppercase letter, '
                        'a lowercase letter, a number, and a special character.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                # User chose their own password — no forced change, clear any temp state
                PasswordService.reset_password(user, new_password=new_password)

                # Issue a fresh JWT pair (auto-login)
                refresh = RefreshToken.for_user(user)
                tokens = {
                    'access':  str(refresh.access_token),
                    'refresh': str(refresh),
                }

                logger.info('forgot_password_reset: password successfully reset for %s', fp_otp._email_hash(email))

        except Exception:
            logger.exception('forgot_password_reset: unexpected error for %s', fp_otp._email_hash(email))
            return Response(
                {'detail': 'Password reset failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Send async security notification (non-blocking)
        try:
            EmailService.send_password_update_confirmation_email(
                user_email=user.email,
                user_name=(user.get_full_name() or user.first_name or 'User').strip(),
            )
        except Exception:
            logger.exception('forgot_password_reset: confirmation email failed for %s', fp_otp._email_hash(email))

        return Response(
            {
                'message': 'Password reset successfully.',
                'user':    UserSerializer(user, context={'request': request}).data,
                'tokens':  tokens,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=['post'],
        url_path='update-password',
        permission_classes=[IsAuthenticated],
    )
    def update_password(self, request):
        """
        Account-settings password update (authenticated users only).

        Request body:
            type     : 'auto' | 'manual'
            password : str   (required when type == 'manual')
            rotation : 'none' | 'weekly' | 'monthly' | 'yearly'  (optional, default 'none')

        Behaviour:
            - 'auto'  → generates a secure password, emails it, keeps session active.
            - 'manual' → validates & sets the provided password, sends a confirmation
                         email (password is NOT included in the email).
        Security:
            - Rate-limited to 5 attempts per user per hour.
            - Manual passwords are validated for strength (min 10 chars, upper, lower,
              digit, special character).
            - Reuse of the current password is rejected.
            - Passwords are NEVER logged.
        """
        import re
        user = request.user

        # ── Rate limiting ────────────────────────────────────────────────────
        rate_key = f'update_password_{user.id}'
        attempts = cache.get(rate_key, 0)
        if attempts >= 5:
            logger.warning(f"Rate limit hit for update_password: {user.email}")
            return Response(
                {'detail': 'Too many password change attempts. Please try again in an hour.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # ── Validate inputs ──────────────────────────────────────────────────
        password_type = request.data.get('type', 'auto')
        custom_password = request.data.get('password', '').strip()
        rotation = request.data.get('rotation', 'none')

        valid_rotations = {'none', 'weekly', 'monthly', 'yearly'}
        if rotation not in valid_rotations:
            return Response(
                {'detail': 'Invalid rotation value. Use none, weekly, monthly, or yearly.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password_type not in ('auto', 'manual'):
            return Response(
                {'detail': 'Invalid type. Use "auto" or "manual".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password_type == 'manual':
            if not custom_password:
                return Response(
                    {'detail': 'Password is required when type is "manual".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            strong_pw = re.compile(
                r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{10,}$'
            )
            if not strong_pw.match(custom_password):
                return Response(
                    {
                        'detail': (
                            'Password must be at least 10 characters and contain an '
                            'uppercase letter, a lowercase letter, a number, and a '
                            'special character (@$!%*?&).'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.check_password(custom_password):
                return Response(
                    {'detail': 'New password cannot be the same as your current password.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── Apply the change ─────────────────────────────────────────────────
        try:
            with transaction.atomic():
                cache.set(rate_key, attempts + 1, timeout=3600)

                if password_type == 'auto':
                    new_password = PasswordService.reset_password(user, rotation=rotation)
                    email_sent = EmailService.send_password_reset_email(
                        user_email=user.email,
                        user_name=user.get_full_name(),
                        new_password=new_password,
                    )
                    detail_msg = (
                        'New password sent to your email.'
                        if email_sent
                        else 'Password changed but email delivery failed. Contact your administrator.'
                    )
                else:
                    PasswordService.reset_password(
                        user, new_password=custom_password, rotation=rotation
                    )
                    email_sent = EmailService.send_password_update_confirmation_email(
                        user_email=user.email,
                        user_name=user.get_full_name(),
                    )
                    detail_msg = 'Password updated successfully.'

                logger.info(
                    f"Password updated for {user.email} "
                    f"(type={password_type}, rotation={rotation})"
                )
                return Response(
                    {
                        'detail': detail_msg,
                        'email_sent': email_sent,
                        'rotation': rotation,
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            logger.error(f"update_password failed for {user.email}: {str(e)}")
            return Response(
                {'detail': 'Password update failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,
        methods=['post'],
        url_path='change-password-first-login',
        permission_classes=[IsAuthenticated],
    )
    def change_password_first_login(self, request):
        """
        Mandatory first-login password change.

        This endpoint is called ONLY when ``must_change_password=True``.
        It verifies the current (temporary) password, enforces the new
        password strength rules, updates the user record, and returns a
        fresh JWT pair so the frontend never has to force a logout.

        Request body:
            current_password : str  — the temporary password the user received
            new_password     : str  — the new password chosen by the user

        On success:
            - password is updated
            - must_change_password is set to False
            - password_changed is set to True
            - last_password_change is updated
            - fresh access + refresh tokens are returned
        """
        import re
        user = request.user

        new_password = request.data.get('new_password', '').strip()

        if not new_password:
            return Response(
                {'detail': 'new_password is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject reuse of the same password (JWT auth already proves identity)
        if user.check_password(new_password):
            return Response(
                {'detail': 'New password must be different from your current password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce password strength: min 8 chars, upper, lower, digit, special
        strong_pw = re.compile(
            r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?]).{8,}$'
        )
        if not strong_pw.match(new_password):
            return Response(
                {
                    'detail': (
                        'Password must be at least 8 characters and contain an uppercase letter, '
                        'a lowercase letter, a number, and a special character.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user.set_password(new_password)
                user.must_change_password    = False
                user.password_changed        = True
                user.last_password_change    = timezone.now()
                user.temp_password_expires_at = None  # Invalidate temporary credential TTL
                user.save(update_fields=[
                    'password', 'must_change_password', 'password_changed',
                    'last_password_change', 'temp_password_expires_at',
                ])

                # Issue a fresh token pair so the frontend stays authenticated
                refresh = RefreshToken.for_user(user)

                logger.info(
                    "First-login password change completed for %s (role=%s)",
                    user.email, user.role,
                )

                return Response(
                    {
                        'detail': 'Password updated successfully.',
                        'user': UserSerializer(user, context={'request': request}).data,
                        'tokens': {
                            'access':  str(refresh.access_token),
                            'refresh': str(refresh),
                        },
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            logger.error("change_password_first_login failed for %s: %s", user.email, str(e))
            return Response(
                {'detail': 'Password change failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


def _invalidate_practitioners_cache(user_or_instance):
    """
    Delete all practitioners-list cache keys for the clinic family of the given
    user/staff instance.  Call this after any create, update, or status change
    that could affect who appears in a branch's practitioner list so that
    Calendar and Diary always see fresh branch-assignment data.
    """
    clinic = getattr(user_or_instance, 'clinic', None)
    if not clinic:
        return
    main_clinic = clinic.main_clinic
    try:
        all_branch_ids = list(main_clinic.get_all_branches().values_list('id', flat=True))
        # Cache keys: '' suffix = All Branches query; numeric suffix = branch-specific
        keys = [f'practitioners_{main_clinic.id}_'] + [
            f'practitioners_{main_clinic.id}_{bid}' for bid in all_branch_ids
        ]
        cache.delete_many(keys)
    except Exception:
        pass  # cache invalidation is best-effort; never break the response


class UserViewSet(viewsets.ModelViewSet):
    """CRUD operations for users / staff management"""
    
    queryset = (
        User.objects.filter(is_deleted=False)
        .select_related('clinic', 'clinic_branch', 'permission_group', 'practitioner_profile')
        .prefetch_related('permission_group__feature_permissions')
    )
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]

    def get_permissions(self):
        # The 'me' action must remain accessible to all authenticated users
        if self.action == 'me':
            return [IsAuthenticated()]
        # Allow practitioners to list users (needed for block appointment user selection)
        if self.action == 'list':
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_queryset(self):
        user = self.request.user
        qs   = self.queryset

        if user.is_admin:
            # Admin sees all users in their clinic family
            base_qs = qs.filter(clinic=user.clinic)
        elif user.is_manager:
            # Manager sees users whose assigned branches intersect with their managed branches.
            # Covers both the legacy single-branch (clinic_branch) and new multi-branch (branch_accesses).
            manager_branch_ids = list(user.branch_accesses.values_list('branch_id', flat=True))
            if user.clinic and manager_branch_ids:
                from django.db.models import Q
                base_qs = qs.filter(clinic=user.clinic).filter(
                    Q(clinic_branch_id__in=manager_branch_ids) |
                    Q(branch_accesses__branch_id__in=manager_branch_ids)
                ).distinct()
            else:
                base_qs = qs.none()
        else:
            base_qs = qs.filter(clinic=user.clinic) if user.clinic else qs.none()

        # ✅ Optional filter: ?clinic_branch=<id>
        branch_id = self.request.query_params.get('clinic_branch')
        if branch_id:
            base_qs = base_qs.filter(clinic_branch_id=branch_id)

        # ✅ Optional filter: ?role=STAFF or ?role=PRACTITIONER
        # Queries the `roles` JSONField (contains) so multi-role users are included.
        role = self.request.query_params.get('role')
        if role:
            base_qs = base_qs.filter(roles__contains=[role])

        return base_qs

    def _validate_branch(self, request, branch_id):
        """
        Helper: verify the branch belongs to the requesting admin/manager's clinic family.
        Returns the Clinic branch instance or raises a validation error dict.
        """
        if not branch_id:
            return None

        main_clinic = request.user.clinic.main_clinic if request.user.clinic else None
        if not main_clinic:
            return None

        try:
            branch = Clinic.objects.get(pk=branch_id, is_deleted=False)
        except Clinic.DoesNotExist:
            return {'error': 'Selected branch does not exist.'}

        # Must be main clinic or a direct branch of it
        if branch.id != main_clinic.id and branch.parent_clinic_id != main_clinic.id:
            return {'error': 'The selected branch does not belong to your clinic.'}

        return branch

    def create(self, request, *args, **kwargs):
        """
        Create new staff / practitioner account.
        ✅ Accepts clinic_branch (single branch) or branch_ids (multi-branch for Managers).
        Auto-generates password and sends via email.

        Phase 9 security rules:
          ─ Only Owner (ADMIN) or Manager (ADMIN_ASSISTANT) may create accounts.
          ─ Manager cannot create Owner or another Manager.
          ─ Branch scope: requested branches must be a subset of the Manager's owned branches.
        """
        actor        = request.user
        is_owner     = actor.is_admin
        is_manager   = actor.is_manager


        # ── Role gate: only Owner or Manager may create staff ─────────────────
        if not (is_owner or is_manager):
            return Response(
                {'detail': 'Only administrators and managers can create staff accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ── Phase 9: Manager role escalation gate ──────────────────────────────
        # Manager may NEVER create Owner or another Manager.
        if is_manager and not is_owner:
            requested_roles = request.data.get('roles', [])
            if not isinstance(requested_roles, list):
                requested_roles = [requested_roles]
            restricted = {'ADMIN', 'ADMIN_ASSISTANT'}
            if restricted & set(requested_roles):
                return Response(
                    {'detail': 'Managers cannot create Owner or Manager accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # ── Phase 9: Manager branch scope enforcement ─────────────────────────
        # requested_branches ⊆ manager_owned_branches
        if is_manager and not is_owner:
            from apps.accounts.models import UserBranchAccess
            manager_branch_ids = set(
                actor.branch_accesses.values_list('branch_id', flat=True)
            )

            # Phase 8: Forcefully inherit Branch Manager's clinic branch.
            # We ignore any clinic_branch sent from the frontend to prevent tampering.
            manager_branch = getattr(request.user, 'clinic_branch_id', None)
            if manager_branch:
                request.data['clinic_branch'] = manager_branch
                request.data['branch_ids'] = [manager_branch]
            elif manager_branch_ids:
                auto_branch = list(manager_branch_ids)[0]
                request.data['clinic_branch'] = auto_branch
                request.data['branch_ids'] = [auto_branch]
            else:
                return Response({'detail': 'Manager has no assigned branches.'}, status=status.HTTP_403_FORBIDDEN)

        # ── Validate branch before touching the serializer ──────────────────
        branch_id    = request.data.get('clinic_branch')
        branch_result = self._validate_branch(request, branch_id)

        if isinstance(branch_result, dict) and 'error' in branch_result:
            return Response({'clinic_branch': branch_result['error']}, status=status.HTTP_400_BAD_REQUEST)

        branch = branch_result  # Clinic instance or None

        # ── Validate remaining fields ─────────────────────────────────────────
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                from datetime import timedelta
                temp_password = PasswordService.generate_temporary_password()
                role          = serializer.validated_data.get('role', 'STAFF')
                roles         = serializer.validated_data.get('roles', [role])
                if not roles:
                    roles = [role]

                # Temporary credentials expire in 48 hours; must_change_password
                # gates all protected routes until the user completes the flow.
                temp_expires = timezone.now() + timedelta(hours=48)

                # Auto-derive the RBAC permission group from the user's roles.
                # If the caller explicitly supplied a permission_group in the
                # payload, respect it; otherwise derive from roles.
                from apps.accounts.models import derive_permission_group_for_roles
                permission_group = (
                    serializer.validated_data.get('permission_group')
                    or derive_permission_group_for_roles(roles, request.user.clinic)
                )

                logger.info(f"Creator: {request.user.email}")
                logger.info(f"Creator Role: {request.user.role}")
                logger.info(f"Creator Branch: {request.user.clinic_branch_id}")
                logger.info(f"Incoming Payload: {request.data}")
                logger.info(f"Assigned Branch: {branch.id if branch else None}")

                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=temp_password,
                    first_name=serializer.validated_data['first_name'],
                    last_name=serializer.validated_data['last_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    role=role,
                    roles=roles,
                    position=serializer.validated_data.get('position', ''),
                    clinic=request.user.clinic,
                    clinic_branch=branch,
                    permission_group=permission_group,
                    password_changed=False,
                    must_change_password=True,
                    temp_password_expires_at=temp_expires,
                )

                logger.info("Practitioner successfully created.")
                logger.info(f"Creator Branch: {request.user.clinic_branch_id}")
                logger.info(f"Assigned Branch: {user.clinic_branch_id}")
                logger.info(f"User ID: {user.id}")

                # ── Sync UserBranchAccess for Manager (ADMIN_ASSISTANT) ──────
                # The serializer validates branch_ids but this view bypasses
                # serializer.save(), so we must sync manually here.
                branch_ids = serializer.validated_data.get('branch_ids', [])
                if branch_ids and 'ADMIN_ASSISTANT' in roles:
                    UserSerializer._sync_branch_accesses(user, branch_ids)
                    # Set clinic_branch FK to primary branch for backward compat
                    if not branch:
                        try:
                            primary = Clinic.objects.get(pk=branch_ids[0])
                            user.clinic_branch = primary
                            user.save(update_fields=['clinic_branch'])
                        except Clinic.DoesNotExist:
                            pass

                # ── Create Practitioner profile if PRACTITIONER is in roles ──
                practitioner_created = False
                if 'PRACTITIONER' in roles:
                    if not Practitioner.objects.filter(user=user).exists():
                        # Extract availability fields from request data
                        availability_data = {
                            'duty_days': request.data.get('duty_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
                            'duty_start_time': request.data.get('duty_start_time', '08:00'),
                            'duty_end_time': request.data.get('duty_end_time', '17:00'),
                            'lunch_start_time': request.data.get('lunch_start_time', '12:00'),
                            'lunch_end_time': request.data.get('lunch_end_time', '13:00'),
                            'duty_schedule': request.data.get('duty_schedule', None),
                            'discipline': request.data.get('discipline', 'OCCUPATIONAL_THERAPY'),
                        }
                        Practitioner.objects.create(
                            user=user,
                            # Use the user's assigned branch as their working clinic when
                            # set (e.g. Admin+Practitioner assigned to a specific branch);
                            # fall back to the main clinic for unrestricted accounts.
                            clinic=branch or request.user.clinic,
                            license_number=request.data.get('license_number', ''),

                            specialization=request.data.get('specialization', ''),
                            consultation_fee=request.data.get('consultation_fee', 0),
                            is_accepting_patients=True,
                            **availability_data
                        )
                        practitioner_created = True
                        # Mirror discipline on the User model so to_representation
                        # always has a non-empty fallback for ADMIN+PRACTITIONER users.
                        discipline_value = availability_data.get('discipline', 'OCCUPATIONAL_THERAPY')
                        if discipline_value:
                            User.objects.filter(pk=user.pk).update(discipline=discipline_value)
                        logger.info(f"Practitioner profile created for: {user.email}")

                if 'STAFF' in roles:
                    # Save Staff availability and discipline directly on the User model
                    duty_schedule = request.data.get('duty_schedule', None)
                    duty_days = request.data.get('duty_days', [])
                    discipline = request.data.get('discipline', '')
                    if duty_schedule is not None or duty_days or discipline:
                        user.duty_schedule = duty_schedule
                        user.duty_days = duty_days if isinstance(duty_days, list) else []
                        user.lunch_start_time = request.data.get('lunch_start_time', '12:00')
                        user.lunch_end_time = request.data.get('lunch_end_time', '13:00')
                        user.discipline = discipline
                        user.save()

                company_name = request.user.clinic.name if request.user.clinic else 'Your Organization'
                email_sent   = EmailService.send_staff_welcome_email(
                    user_email=user.email,
                    user_name=user.get_full_name(),
                    role=role,
                    password=temp_password,
                    company_name=company_name,
                )
                
                if not email_sent:
                    logger.warning(f"Email failed to send for {user.email}")
                
                logger.info(
                    f"Staff account created: {user.email} "
                    f"(Roles: {roles}, Branch: {branch.name if branch else 'All'}) "
                    f"by {request.user.email}"
                )

                # Purge practitioners cache so Calendar/Diary pick up the new
                # member immediately without waiting for the 5-minute TTL.
                _invalidate_practitioners_cache(user)

                response_data = self.get_serializer(user).data
                return Response({
                    **response_data,
                    'message': (
                        f'Account created successfully for role(s): {", ".join(roles)}. '
                        f'Login credentials sent to email.'
                    ),
                    'email_sent': email_sent,
                    'practitioner_profile_created': practitioner_created,
                }, status=status.HTTP_201_CREATED, headers=self.get_success_headers(response_data))
                
        except Exception as e:
            logger.error(f"Staff creation failed: {str(e)}")
            return Response(
                {'detail': f'Failed to create staff account: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        """
        Update staff / practitioner.
        ✅ Validates clinic_branch belongs to the same clinic family on update too.
        ✅ Creates Practitioner profile when role is changed TO 'PRACTITIONER'.
        ✅ Detects email changes: resets password, notifies new address, forces
           must_change_password on next login.
        Phase 9: Manager cannot escalate target's role to ADMIN/ADMIN_ASSISTANT,
                 and Manager cannot reassign users to branches they don't own.
        """
        actor      = request.user
        is_owner   = actor.is_admin
        is_manager = actor.is_manager

        if not (is_owner or is_manager):
            return Response(
                {'detail': 'Only administrators and managers can update staff accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Re-use instance if already fetched by the manager gate; otherwise fetch now.
        if 'instance' not in dir():
            instance = self.get_object()

        # ── Phase 9: Manager escalation gate on update ─────────────────────────
        if is_manager and not is_owner:
            incoming_roles = request.data.get('roles', [])
            if not isinstance(incoming_roles, list):
                incoming_roles = [incoming_roles]

            current_roles = instance.roles if getattr(instance, 'roles', None) else [instance.role]
            added_roles = list(set(incoming_roles) - set(current_roles))

            # ── Phase 2: Temporary Debug Logs ──
            print("Current Roles:", current_roles)
            print("Incoming Roles:", incoming_roles)
            print("Added Roles:", added_roles)
            print("Request User:", actor.id, actor.roles)

            restricted = {'ADMIN', 'ADMIN_ASSISTANT'}
            
            # Phase 3: Validate only the newly-added roles, not existing ones
            if restricted & set(added_roles):
                return Response(
                    {'detail': 'Managers cannot assign Owner or Manager roles.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Phase 4: Prevent modifying another Manager's account, but allow self-editing
            if instance.is_manager and instance.id != actor.id:
                return Response(
                    {"detail": "Managers cannot modify another Manager's account."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Prevent Managers from changing a user's branch
            request.data.pop('clinic_branch', None)
            request.data.pop('branch_ids', None)

        partial     = kwargs.pop('partial', False)
        old_email   = instance.email  # capture before any mutation
        branch_id   = request.data.get('clinic_branch')

        # Only validate branch when it is explicitly included in payload
        if 'clinic_branch' in request.data:
            branch_result = self._validate_branch(request, branch_id)
            if isinstance(branch_result, dict) and 'error' in branch_result:
                return Response({'clinic_branch': branch_result['error']}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Email change detection ────────────────────────────────────────────
        new_email = serializer.validated_data.get('email', old_email)
        email_changed = new_email != old_email

        if email_changed:
            # Prevent hijacking an address already belonging to another user
            if User.objects.filter(email__iexact=new_email).exclude(pk=instance.pk).exists():
                return Response(
                    {'email': 'This email address is already in use by another account.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_role = instance.role
        old_effective_roles = instance.get_effective_roles()
        new_role_requested = serializer.validated_data.get('role', old_role)
        new_roles_requested = serializer.validated_data.get('roles', old_effective_roles)

        # ── Owner demotion protection ─────────────────────────────────────────
        # Protect when ADMIN is being removed from the roles list
        if 'ADMIN' in instance.get_effective_roles() and 'ADMIN' not in new_roles_requested:
            remaining_owners = User.objects.filter(
                clinic=instance.clinic,
                is_deleted=False,
                is_active=True,
            ).filter(roles__contains=['ADMIN']).exclude(pk=instance.pk).count()
            if remaining_owners == 0:
                return Response(
                    {'detail': 'Cannot remove Admin role from the last Owner account. '
                               'Assign another Owner first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── Owner deactivation protection ────────────────────────────────────
        if 'ADMIN' in instance.get_effective_roles() and serializer.validated_data.get('is_active') is False:
            remaining_active_owners = User.objects.filter(
                clinic=instance.clinic,
                is_deleted=False,
                is_active=True,
            ).filter(roles__contains=['ADMIN']).exclude(pk=instance.pk).count()
            if remaining_active_owners == 0:
                return Response(
                    {'detail': 'Cannot deactivate the last active Owner account.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        self.perform_update(serializer)
        instance.refresh_from_db()
        new_role  = instance.role
        new_roles = instance.get_effective_roles()

        # ── Email change: reset credentials and notify new address ────────────
        if email_changed:
            from datetime import timedelta
            temp_password = PasswordService.generate_temporary_password()
            instance.set_password(temp_password)
            instance.must_change_password     = True
            instance.password_changed         = False
            instance.temp_password_expires_at = timezone.now() + timedelta(hours=48)
            instance.save(update_fields=[
                'password', 'must_change_password',
                'password_changed', 'temp_password_expires_at',
            ])

            company_name = (
                request.user.clinic.name if request.user.clinic else 'Your Organization'
            )
            email_sent = EmailService.send_email_change_notification(
                user_email=new_email,
                user_name=instance.get_full_name(),
                temp_password=temp_password,
                company_name=company_name,
            )

            logger.info(
                "Email address changed for user (id=%s): %s → %s by %s (email_sent=%s)",
                instance.pk, old_email, new_email, request.user.email, email_sent,
            )

        # ── Sync Practitioner profile when PRACTITIONER added/removed ────────
        practitioner_created = False
        had_practitioner = 'PRACTITIONER' in old_effective_roles
        has_practitioner = 'PRACTITIONER' in new_roles

        if has_practitioner:
            # ── Ensure an active Practitioner profile exists ──────────────
            # Three sub-cases handled here:
            #   (a) Profile never existed             → create it fresh
            #   (b) Profile exists, is_deleted=False  → no-op (leave intact)
            #   (c) Profile exists, is_deleted=True   → restore it
            #
            # The old get_or_create(user=instance) without is_deleted=False
            # would find a soft-deleted profile in case (c) and return it
            # unchanged — leaving is_deleted=True and the user invisible in
            # the Diary/Calendar practitioner list even after the role was
            # re-added.  We now restore soft-deleted records explicitly first.

            restored_count = Practitioner.objects.filter(
                user=instance, is_deleted=True
            ).update(is_deleted=False, deleted_at=None)

            if restored_count:
                # Profile was soft-deleted and has now been restored.
                practitioner_created = True
                # Refresh the clinic assignment in case the user was reassigned
                # while the profile was dormant.
                Practitioner.objects.filter(user=instance).update(
                    clinic=instance.clinic_branch or instance.clinic or request.user.clinic,
                )
                logger.info(
                    "Practitioner profile restored (un-soft-deleted) for: %s by %s",
                    instance.email, request.user.email,
                )
            elif not Practitioner.objects.filter(user=instance, is_deleted=False).exists():
                # No profile at all — create a fresh one.
                Practitioner.objects.create(
                    user=instance,
                    # Prefer the user's specific branch over the main clinic so
                    # branch-assigned Admin+Practitioner users are scoped correctly.
                    clinic=instance.clinic_branch or instance.clinic or request.user.clinic,
                    license_number='',
                    specialization='',
                    discipline=request.data.get('discipline', 'OCCUPATIONAL_THERAPY'),
                    consultation_fee=0,
                    is_accepting_patients=True,
                    duty_days=request.data.get('duty_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
                    duty_start_time=request.data.get('duty_start_time', '08:00'),
                    duty_end_time=request.data.get('duty_end_time', '17:00'),
                    lunch_start_time=request.data.get('lunch_start_time', '12:00'),
                    lunch_end_time=request.data.get('lunch_end_time', '13:00'),
                    duty_schedule=request.data.get('duty_schedule', None),
                )
                practitioner_created = True

            if practitioner_created:
                # Mirror discipline on the User model so to_representation always has
                # a non-empty fallback for ADMIN+PRACTITIONER users.
                new_discipline = request.data.get('discipline', 'OCCUPATIONAL_THERAPY')
                if new_discipline:
                    User.objects.filter(pk=instance.pk).update(discipline=new_discipline)
                logger.info(
                    "Practitioner profile created/restored on role change for: %s by %s",
                    instance.email, request.user.email,
                )

        elif not has_practitioner and had_practitioner:
            print(f">>> [UserViewSet] Triggering practitioner removal workflow for {instance.email} <<<")
            # ── PRACTITIONER role removed — run deactivation workflow ─────
            from apps.accounts.services.practitioner_deactivation import (
                get_practitioner_removal_impact,
                execute_practitioner_removal,
            )

            confirm_removal = request.data.get('confirm_practitioner_removal', False)

            if not confirm_removal:
                # Return 409 Conflict with impact counts so the frontend can
                # show a confirmation modal before proceeding.
                impact = get_practitioner_removal_impact(instance.pk)
                if impact.get('has_impact'):
                    return Response(
                        {
                            'detail': 'Practitioner role removal requires confirmation.',
                            'practitioner_removal_required': True,
                            **impact,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                # No future data to clean — safe to proceed without confirmation

            # Either confirmed or no impact — execute the removal
            print(f">>> [UserViewSet] Executing execute_practitioner_removal for {instance.email} <<<")
            removal_result = execute_practitioner_removal(
                user_id=instance.pk,
                performed_by=request.user,
            )
            print(f">>> [UserViewSet] removal_result: {removal_result} <<<")
            logger.info(
                "Practitioner role removal executed for: %s by %s — %s",
                instance.email, request.user.email, removal_result,
            )

        logger.info(
            "Staff account updated: %s (roles: %s → %s) by %s",
            instance.email, old_role, new_roles, request.user.email,
        )

        # ── Invalidate practitioners cache ────────────────────────────────────
        # Branch/role changes are now live — purge the 5-minute practitioners
        # cache so Diary/Calendar refetch with the updated assignment immediately
        # instead of serving stale branch data for up to 5 minutes.
        _invalidate_practitioners_cache(instance)

        response_data = self.get_serializer(instance).data
        return Response({
            **response_data,
            **({'practitioner_profile_created': True} if practitioner_created else {}),
        })

    @action(
        detail=True,
        methods=['get'],
        url_path='practitioner-role-impact',
        permission_classes=[IsAuthenticated, IsAdminOrStaffOnly],
    )
    def practitioner_role_impact(self, request, pk=None):
        """
        GET /users/{id}/practitioner-role-impact/

        Returns counts of future operational data (appointments, block-outs,
        calendar events) that would be deleted if the PRACTITIONER role is
        removed from this user.

        Used by the frontend to populate the confirmation modal before the
        admin commits to the role change.
        """
        target = self.get_object()

        # Only meaningful if the user currently has the PRACTITIONER role
        if 'PRACTITIONER' not in target.get_effective_roles():
            return Response(
                {
                    'practitioner_id': None,
                    'future_appointments': 0,
                    'future_blockouts': 0,
                    'future_calendar_events': 0,
                    'has_impact': False,
                }
            )

        from apps.accounts.services.practitioner_deactivation import (
            get_practitioner_removal_impact,
        )
        impact = get_practitioner_removal_impact(target.pk)
        return Response(impact)

    def destroy(self, request, *args, **kwargs):
        """Soft delete user — with Owner protection."""
        instance = self.get_object()

        if instance.id == request.user.id:
            return Response(
                {'detail': 'You cannot delete your own account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Owner protection: never delete the last ADMIN ────────────────────
        if 'ADMIN' in instance.get_effective_roles():
            remaining_owners = User.objects.filter(
                clinic=instance.clinic,
                is_deleted=False,
                is_active=True,
            ).filter(roles__contains=['ADMIN']).exclude(pk=instance.pk).count()
            if remaining_owners == 0:
                return Response(
                    {'detail': 'Cannot delete the last Owner account. '
                               'Assign another Owner first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        import uuid
        
        # Free up the email to allow reuse
        unique_suffix = str(uuid.uuid4())[:8]
        old_email = instance.email
        instance.email = f"deleted_{unique_suffix}_{old_email}"[:254]
        
        instance.is_deleted = True
        instance.is_active  = False
        instance.save(update_fields=['email', 'is_deleted', 'is_active'])

        # Cascade soft-delete to Practitioner if it exists
        if hasattr(instance, 'practitioner_profile'):
            practitioner = instance.practitioner_profile
            # Check for future appointments and cancel them
            from apps.appointments.models import Appointment
            from django.utils import timezone
            
            future_appointments = Appointment.objects.filter(
                practitioner=practitioner,
                date__gte=timezone.localdate(),
                status__in=['SCHEDULED', 'CONFIRMED', 'PENDING']
            )
            for appt in future_appointments:
                appt.status = 'CANCELLED'
                appt.cancellation_reason = 'Practitioner is no longer available.'
                appt.cancelled_at = timezone.now()
                appt.cancelled_by = request.user
                appt.save(update_fields=['status', 'cancellation_reason', 'cancelled_at', 'cancelled_by'])
                
            practitioner.soft_delete()
        logger.info(f"User soft deleted: {instance.email} by {request.user.email}")

        return Response(
            {'detail': 'Staff member removed successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )
    
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Get or update the currently authenticated user's own profile."""
        logger.info(f"[UserViewSet.me] Request method: {request.method}, content_type: {request.content_type}")
        logger.info(f"[UserViewSet.me] request.FILES keys: {list(request.FILES.keys())}")
        logger.info(f"[UserViewSet.me] request.data keys: {list(request.data.keys())}")
        
        if request.method == 'GET':
            return Response(self.get_serializer(request.user).data)

        content_type = request.content_type or ''

        # ── Avatar removal via JSON: { "remove_avatar": true } ──────────
        if 'application/json' in content_type:
            logger.info("[UserViewSet.me] Handling JSON request")
            if request.data.get('remove_avatar') is True:
                # Delete the file from storage if it exists
                if request.user.avatar:
                    try:
                        request.user.avatar.delete(save=False)
                    except Exception as e:
                        logger.error(f"[UserViewSet.me] Error deleting avatar: {e}")
                request.user.avatar = None
                request.user.save(update_fields=['avatar'])
                return Response(self.get_serializer(request.user).data)

            # Regular JSON profile update (name, phone)
            ALLOWED = {'first_name', 'last_name', 'phone'}
            data = {k: v for k, v in request.data.items() if k in ALLOWED}
            if not data:
                return Response(self.get_serializer(request.user).data)

            serializer = self.get_serializer(
                request.user, data=data, partial=True,
                context={'request': request}
            )
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            serializer.save()
            return Response(self.get_serializer(request.user).data)

        # ── Avatar upload via multipart/form-data ───────────────────────
        if 'multipart/form-data' in content_type or 'avatar' in request.FILES:
            logger.info("[UserViewSet.me] Handling multipart/form-data request")
            avatar_file = request.FILES.get('avatar')
            logger.info(f"[UserViewSet.me] avatar_file: {avatar_file}")
            
            # Check if this is a combined update (avatar + other fields)
            has_profile_fields = any(k in request.data for k in ['first_name', 'last_name', 'phone'])
            logger.info(f"[UserViewSet.me] has_profile_fields: {has_profile_fields}")
            
            try:
                # Delete old avatar file from storage
                if request.user.avatar:
                    logger.info(f"[UserViewSet.me] Deleting old avatar: {request.user.avatar.name}")
                    try:
                        request.user.avatar.delete(save=False)
                    except Exception as e:
                        logger.error(f"[UserViewSet.me] Error deleting old avatar: {e}")
                
                # Handle avatar file
                if avatar_file:
                    logger.info(f"[UserViewSet.me] Setting new avatar: {avatar_file.name}")
                    request.user.avatar = avatar_file
                
                # Handle remove_avatar flag
                remove_avatar_val = request.data.get('remove_avatar')
                logger.info(f"[UserViewSet.me] remove_avatar value: {remove_avatar_val}")
                if remove_avatar_val == 'true' or remove_avatar_val is True:
                    if request.user.avatar:
                        try:
                            request.user.avatar.delete(save=False)
                        except Exception as e:
                            logger.error(f"[UserViewSet.me] Error deleting avatar (remove): {e}")
                        request.user.avatar = None
                
                # Handle other profile fields
                if has_profile_fields:
                    first_name = request.data.get('first_name') or request.user.first_name
                    last_name = request.data.get('last_name') or request.user.last_name
                    phone = request.data.get('phone') if request.data.get('phone') else request.user.phone
                    
                    logger.info(f"[UserViewSet.me] Updating profile: first_name={first_name}, last_name={last_name}, phone={phone}")
                    request.user.first_name = first_name
                    request.user.last_name = last_name
                    request.user.phone = phone
                
                request.user.save()
                logger.info(f"[UserViewSet.me] Save successful. New avatar: {request.user.avatar}")
                return Response(self.get_serializer(request.user).data)
            except Exception as e:
                logger.error(f"[UserViewSet.me] Error during save: {e}", exc_info=True)
                return Response({'detail': f'Error saving profile: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.warning(f"[UserViewSet.me] Unsupported content type: {content_type}")
        return Response(
            {'detail': 'Unsupported content type.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # ── Multi-Role Management ─────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'put'], url_path='roles',
            permission_classes=[IsAuthenticated])
    def manage_roles(self, request, pk=None):
        """
        GET  /users/{id}/roles/  → list current roles
        PUT  /users/{id}/roles/  → replace roles list (Admin only)

        Request body (PUT):
            { "roles": ["ADMIN", "PRACTITIONER"] }

        Business rules:
        - At least one role must remain.
        - Removing ADMIN from the last owner is blocked.
        - Adding PRACTITIONER auto-creates the Practitioner profile.
        - Removing PRACTITIONER soft-deletes the Practitioner profile.
        - Every change is recorded in UserRoleChangeLog for audit.
        """
        target = self.get_object()

        if request.method == 'GET':
            return Response({'roles': target.get_effective_roles()})

        # ── PUT: only admins may change roles ────────────────────────────────
        if not request.user.is_admin:
            return Response(
                {'detail': 'Only administrators can modify user roles.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_roles_raw = request.data.get('roles', [])
        if not isinstance(new_roles_raw, list) or not new_roles_raw:
            return Response(
                {'detail': '`roles` must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = {r for r, _ in User.ROLE_CHOICES}
        invalid = [r for r in new_roles_raw if r not in valid_roles]
        if invalid:
            return Response(
                {'detail': f'Invalid role(s): {invalid}. Valid: {list(valid_roles)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deduplicate while preserving priority order
        new_roles = [r for r in ROLE_PRIORITY if r in new_roles_raw]
        old_roles  = target.get_effective_roles()

        # ── Owner guard ──────────────────────────────────────────────────────
        if 'ADMIN' in old_roles and 'ADMIN' not in new_roles:
            remaining = User.objects.filter(
                clinic=target.clinic,
                is_deleted=False,
                is_active=True,
            ).filter(roles__contains=['ADMIN']).exclude(pk=target.pk).count()
            if remaining == 0:
                return Response(
                    {'detail': 'Cannot remove Admin role from the last Owner. '
                               'Assign another Owner first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            target.roles = new_roles
            target.save()
            target.refresh_from_db()

            # ── Sync Practitioner profile ─────────────────────────────────
            if 'PRACTITIONER' in new_roles and 'PRACTITIONER' not in old_roles:
                Practitioner.objects.get_or_create(
                    user=target,
                    defaults={
                        'clinic':               target.clinic or request.user.clinic,
                        'is_accepting_patients': True,
                        'discipline':           'OCCUPATIONAL_THERAPY',
                    },
                )
                logger.info('Practitioner profile created for %s via roles update', target.email)

            elif 'PRACTITIONER' not in new_roles and 'PRACTITIONER' in old_roles:
                # ── PRACTITIONER removal via roles endpoint ───────────────
                from apps.accounts.services.practitioner_deactivation import (
                    get_practitioner_removal_impact,
                    execute_practitioner_removal,
                )

                confirm_removal = request.data.get('confirm_practitioner_removal', False)

                if not confirm_removal:
                    impact = get_practitioner_removal_impact(target.pk)
                    if impact.get('has_impact'):
                        return Response(
                            {
                                'detail': 'Practitioner role removal requires confirmation.',
                                'practitioner_removal_required': True,
                                **impact,
                            },
                            status=status.HTTP_409_CONFLICT,
                        )

                execute_practitioner_removal(
                    user_id=target.pk,
                    performed_by=request.user,
                )
                logger.info('Practitioner deactivation executed for %s via roles update', target.email)

            # ── Audit log ─────────────────────────────────────────────────
            added   = set(new_roles) - set(old_roles)
            removed = set(old_roles) - set(new_roles)
            log_entries = []
            for r in added:
                log_entries.append(UserRoleChangeLog(
                    target_user_id=target.pk,
                    target_user_email=target.email,
                    changed_by_id=request.user.pk,
                    changed_by_email=request.user.email,
                    action='add',
                    role=r,
                    roles_before=old_roles,
                    roles_after=new_roles,
                ))
            for r in removed:
                log_entries.append(UserRoleChangeLog(
                    target_user_id=target.pk,
                    target_user_email=target.email,
                    changed_by_id=request.user.pk,
                    changed_by_email=request.user.email,
                    action='remove',
                    role=r,
                    roles_before=old_roles,
                    roles_after=new_roles,
                ))
            if log_entries:
                UserRoleChangeLog.objects.bulk_create(log_entries)

            logger.info(
                'Roles updated for %s: %s → %s by %s',
                target.email, old_roles, new_roles, request.user.email,
            )

            # ── Emit real-time permission refresh ────────────────────────
            from apps.accounts.permission_events import emit_permissions_updated
            emit_permissions_updated(target.pk)

        return Response(self.get_serializer(target).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer


# ── RBAC: Permission Group Management ────────────────────────────────────────

class PermissionGroupViewSet(viewsets.ModelViewSet):
    """
    CRUD for clinic-scoped Permission Groups.

    Rules:
    * Only ADMIN users may manage permission groups.
    * Groups are scoped to the requesting admin's clinic.
    * Protected groups (Owner) cannot be deleted.
    * At least one Owner group must always exist.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = PermissionGroupSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return PermissionGroup.objects.none()
        if user.is_admin and user.clinic:
            # Owner sees ALL permission groups
            main_clinic = user.clinic.main_clinic
            return (
                PermissionGroup.objects
                .filter(clinic=main_clinic)
                .prefetch_related('feature_permissions')
                .order_by('role_template', 'name')
            )
        if user.is_manager and user.clinic:
            # Manager sees all groups EXCEPT Owner-template groups
            main_clinic = user.clinic.main_clinic
            return (
                PermissionGroup.objects
                .filter(clinic=main_clinic)
                .exclude(role_template='OWNER')
                .prefetch_related('feature_permissions')
                .order_by('role_template', 'name')
            )
        # Non-admin/non-manager: read-only, own group only
        if user.permission_group_id:
            return PermissionGroup.objects.filter(pk=user.permission_group_id).prefetch_related('feature_permissions')
        return PermissionGroup.objects.none()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PermissionGroupWriteSerializer
        return PermissionGroupSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrStaffOnly()]

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin or user.is_manager):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only administrators and managers can create permission groups.')
        # Managers cannot create Owner-template groups
        if user.is_manager and not user.is_admin:
            from rest_framework.exceptions import PermissionDenied
            if serializer.validated_data.get('role_template') == 'OWNER':
                raise PermissionDenied('Managers cannot create Owner permission groups.')
        main_clinic = user.clinic.main_clinic
        serializer.save(clinic=main_clinic)

    def perform_update(self, serializer):
        """Save then notify every active member of the updated group."""
        user = self.request.user
        # Managers cannot edit Owner-template groups
        if user.is_manager and not user.is_admin and serializer.instance.role_template == 'OWNER':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Managers cannot edit Owner permission groups.')
        instance = serializer.save()
        self._emit_permission_updates(instance)

    def _emit_permission_updates(self, group):
        """
        Emit a lightweight permissions_updated WS event to all active users
        assigned to `group`.  Non-fatal: failures are logged and ignored.
        """
        try:
            from apps.accounts.permission_events import emit_permissions_updated
            user_ids = list(
                group.users.filter(is_deleted=False, is_active=True)
                           .values_list('id', flat=True)
            )
            for uid in user_ids:
                emit_permissions_updated(uid)
            if user_ids:
                logger.debug(
                    '[PermissionGroupViewSet] Emitted permissions_updated to %d user(s) in group "%s"',
                    len(user_ids), group.name,
                )
        except Exception as exc:
            logger.warning('[PermissionGroupViewSet] Could not emit permission updates: %s', exc)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.is_protected:
            return Response(
                {'detail': f'The "{instance.name}" group is protected and cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reassign members to no group before deletion
        instance.users.all().update(permission_group=None)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """Clone a permission group with a new name."""
        source = self.get_object()
        new_name = request.data.get('name', f'{source.name} (Copy)')

        if not (request.user.is_admin or request.user.is_manager):
            return Response({'detail': 'Only administrators and managers can duplicate groups.'}, status=403)
        # Managers cannot duplicate Owner groups
        if request.user.is_manager and not request.user.is_admin and source.role_template == 'OWNER':
            return Response({'detail': 'Managers cannot duplicate Owner permission groups.'}, status=403)

        main_clinic = request.user.clinic.main_clinic
        if PermissionGroup.objects.filter(clinic=main_clinic, name=new_name).exists():
            return Response({'detail': 'A group with that name already exists.'}, status=400)

        with transaction.atomic():
            new_group = PermissionGroup.objects.create(
                clinic=main_clinic,
                name=new_name,
                description=request.data.get('description', source.description),
                role_template='CUSTOM',
                is_protected=False,
                is_system_template=False,
            )
            for fp in source.feature_permissions.all():
                FeaturePermission.objects.create(
                    group=new_group,
                    feature_key=fp.feature_key,
                    access_level=fp.access_level,
                )

        return Response(PermissionGroupSerializer(new_group).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign-user')
    def assign_user(self, request, pk=None):
        """Assign a user to this permission group."""
        group = self.get_object()
        if not (request.user.is_admin or request.user.is_manager):
            return Response({'detail': 'Only administrators and managers can assign permission groups.'}, status=403)
        # Managers cannot assign users to Owner groups
        if request.user.is_manager and not request.user.is_admin and group.role_template == 'OWNER':
            return Response({'detail': 'Managers cannot assign users to Owner permission groups.'}, status=403)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required.'}, status=400)

        try:
            target = User.objects.get(
                pk=user_id,
                clinic=request.user.clinic,
                is_deleted=False,
            )
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=404)

        # Owner protection: prevent removing the last admin from Owner group
        if target.role == 'ADMIN' and target.permission_group and target.permission_group.is_protected:
            remaining = User.objects.filter(
                clinic=request.user.clinic,
                role='ADMIN',
                permission_group=target.permission_group,
                is_deleted=False,
                is_active=True,
            ).exclude(pk=target.pk).count()
            if remaining == 0:
                return Response(
                    {'detail': 'Cannot reassign the last Owner. Add another Owner first.'},
                    status=400,
                )

        target.permission_group = group
        target.save(update_fields=['permission_group'])

        # Notify the reassigned user immediately so their UI refreshes
        try:
            from apps.accounts.permission_events import emit_permissions_updated
            emit_permissions_updated(target.pk)
        except Exception as exc:
            logger.warning('[PermissionGroupViewSet.assign_user] Could not emit update: %s', exc)

        return Response(UserSerializer(target).data)

    @action(detail=False, methods=['get'], url_path='feature-keys')
    def feature_keys(self, request):
        """Return all valid feature keys and their labels."""
        KEY_LABELS = {
            'dashboard':        'Dashboard',
            'appointments':     'Appointments',
            'calendar':         'Calendar',
            'diary':            'Diary',
            'clinical_notes':   'Clinical Notes',
            'client_cases':     'Client Cases',
            'patients':         'Patients',
            'reports':          'Reports',
            'inventory':        'Inventory',
            'invoices':         'Invoices',
            'billing':          'Billing',
            'subscriptions':    'Subscriptions',
            'setup':            'Setup',
            'staff_management': 'Staff Management',
            'permissions':      'Permissions',
            'settings':         'Settings',
            'documents':        'Documents',
            'outcome_measures': 'Outcome Measures',
            'contacts':         'Contacts',
            'communication':    'Communication',
        }
        return Response([
            {'key': k, 'label': KEY_LABELS.get(k, k.replace('_', ' ').title())}
            for k in FEATURE_KEYS
        ])
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly] 