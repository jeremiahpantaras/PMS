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
from .models import User, Role, Permission
from .serializers import (
    UserSerializer, AdminRegistrationSerializer, UserRegistrationSerializer,
    RoleSerializer, PermissionSerializer, PasswordChangeSerializer
)
from .services.password_service import PasswordService
from .services.email_service import EmailService
from .utils.generators import generate_verification_code
from apps.clinics.models import Clinic, Practitioner
from apps.common.permissions import IsAdminOrStaffOnly
import logging

logger = logging.getLogger(__name__)


class AuthViewSet(viewsets.GenericViewSet):
    """Authentication endpoints"""
    
    permission_classes = [AllowAny]
    
    def get_permissions(self):
        if self.action in ['register_admin', 'register', 'login', 'verify_token']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['post'], url_path='register-admin', permission_classes=[AllowAny])
    def register_admin(self, request):
        """Register admin — auto-generates password, emails credentials,
        and creates a PortalLink for the new clinic."""
        serializer = AdminRegistrationSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                temp_password = PasswordService.generate_temporary_password()

                # Clinic is created with minimal data — admin fills in the rest
                # during the clinic profile setup step (including clinic email).
                # Admin email is personal only and NOT copied to the clinic.
                clinic = Clinic.objects.create(
                    name=serializer.validated_data['company_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    email='',          # ✅ left blank — admin fills during setup
                    address='',
                    city='',
                    province='',
                    postal_code='',
                    is_active=True,
                    is_main_branch=True,
                )

                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=temp_password,
                    first_name=serializer.validated_data['first_name'],
                    last_name=serializer.validated_data['last_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    role='ADMIN',
                    clinic=clinic,
                    password_changed=False
                )

                # ── Auto-create portal link for the new clinic ───────────────
                from apps.patients.models import PortalLink
                portal_link, _ = PortalLink.get_or_create_for_clinic(clinic)
                logger.info(
                    f"Portal link auto-created for new clinic: {clinic.name} "
                    f"(token: {portal_link.token})"
                )

                email_sent = EmailService.send_welcome_email(
                    user_email=user.email,
                    user_name=user.get_full_name(),
                    password=temp_password,
                    company_name=clinic.name
                )

                if not email_sent:
                    logger.warning(f"Email failed to send for {user.email}")

                return Response({
                    'message': 'Account created successfully! Check your email for login credentials.',
                    'email_sent': email_sent,
                    'clinic': {'id': clinic.id, 'name': clinic.name},
                    'portal_token': portal_link.token,
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Admin registration failed: {str(e)}", exc_info=True)
            import traceback
            traceback.print_exc()
            return Response(
                {'detail': f'Registration failed: {str(e)}'},  # ✅ expose actual error in dev
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        """User login."""
        email    = request.data.get('email')
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
        
        refresh = RefreshToken.for_user(user)
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'needs_password_change': user.needs_password_change
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
        email = request.data.get('email')
        
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
        email = request.data.get('email')
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
        email = request.data.get('email')
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
        
        # Generate new password
        new_password = PasswordService.generate_temporary_password()
        
        # Set new password
        user.set_password(new_password)
        user.password_changed = False
        user.save(update_fields=['password', 'password_changed'])
        
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


class UserViewSet(viewsets.ModelViewSet):
    """CRUD operations for users / staff management"""
    
    queryset = User.objects.filter(is_deleted=False).select_related('clinic', 'clinic_branch')
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
        else:
            base_qs = qs.filter(clinic=user.clinic) if user.clinic else qs.none()

        # ✅ Optional filter: ?clinic_branch=<id>
        branch_id = self.request.query_params.get('clinic_branch')
        if branch_id:
            base_qs = base_qs.filter(clinic_branch_id=branch_id)

        # ✅ Optional filter: ?role=STAFF or ?role=PRACTITIONER
        role = self.request.query_params.get('role')
        if role:
            base_qs = base_qs.filter(role=role)

        return base_qs

    def _validate_branch(self, request, branch_id):
        """
        Helper: verify the branch belongs to the requesting admin's clinic family.
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
        ✅ Now accepts clinic_branch in the request body.
        Auto-generates password and sends via email.
        Only admins can create users.
        """
        if not request.user.is_admin:
            return Response(
                {'detail': 'Only administrators can create staff accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # ── Validate branch before touching the serializer ──────────────────
        branch_id    = request.data.get('clinic_branch')
        branch_result = self._validate_branch(request, branch_id)

        if isinstance(branch_result, dict) and 'error' in branch_result:
            return Response({'clinic_branch': branch_result['error']}, status=status.HTTP_400_BAD_REQUEST)

        branch = branch_result  # Clinic instance or None

        # ── Validate remaining fields ────────────────────────────────────────
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                temp_password = PasswordService.generate_temporary_password()
                role          = serializer.validated_data.get('role', 'STAFF')
                
                user = User.objects.create_user(
                    email=serializer.validated_data['email'],
                    password=temp_password,
                    first_name=serializer.validated_data['first_name'],
                    last_name=serializer.validated_data['last_name'],
                    phone=serializer.validated_data.get('phone', ''),
                    role=role,
                    clinic=request.user.clinic,
                    clinic_branch=branch,          # ✅ assign branch
                    password_changed=False
                )
                
                # ── Create Practitioner profile if needed ────────────────────
                practitioner_created = False
                if role == 'PRACTITIONER':
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
                            clinic=request.user.clinic,
                            license_number=request.data.get('license_number', ''),
                            specialization=request.data.get('specialization', ''),
                            consultation_fee=request.data.get('consultation_fee', 0),
                            is_accepting_patients=True,
                            **availability_data
                        )
                        practitioner_created = True
                        logger.info(f"Practitioner profile created for: {user.email}")
                elif role == 'STAFF':
                    # Save Staff availability directly on the User model
                    duty_schedule = request.data.get('duty_schedule', None)
                    duty_days = request.data.get('duty_days', [])
                    if duty_schedule is not None or duty_days:
                        user.duty_schedule = duty_schedule
                        user.duty_days = duty_days if isinstance(duty_days, list) else []
                        user.lunch_start_time = request.data.get('lunch_start_time', '12:00')
                        user.lunch_end_time = request.data.get('lunch_end_time', '13:00')
                        user.save()

                company_name = request.user.clinic.name if request.user.clinic else 'Your Organization'
                email_sent   = EmailService.send_welcome_email(
                    user_email=user.email,
                    user_name=user.get_full_name(),
                    password=temp_password,
                    company_name=company_name
                )
                
                if not email_sent:
                    logger.warning(f"Email failed to send for {user.email}")
                
                logger.info(
                    f"Staff account created: {user.email} "
                    f"(Role: {role}, Branch: {branch.name if branch else 'All'}) "
                    f"by {request.user.email}"
                )
                
                response_data = self.get_serializer(user).data
                return Response({
                    **response_data,
                    'message': (
                        f'{"Practitioner" if role == "PRACTITIONER" else "Staff"} account created successfully! '
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
        """
        if not request.user.is_admin:
            return Response(
                {'detail': 'Only administrators can update staff accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        partial     = kwargs.pop('partial', False)
        instance    = self.get_object()
        branch_id   = request.data.get('clinic_branch')

        # Only validate branch when it is explicitly included in payload
        if 'clinic_branch' in request.data:
            branch_result = self._validate_branch(request, branch_id)
            if isinstance(branch_result, dict) and 'error' in branch_result:
                return Response({'clinic_branch': branch_result['error']}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_role = instance.role
        self.perform_update(serializer)
        instance.refresh_from_db()
        new_role = instance.role

        # ── Sync Practitioner profile when role changes ──────────────────────
        practitioner_created = False
        if new_role == 'PRACTITIONER' and old_role != 'PRACTITIONER':
            # Role upgraded to PRACTITIONER — ensure profile exists
            _, practitioner_created = Practitioner.objects.get_or_create(
                user=instance,
                defaults={
                    'clinic':                 instance.clinic or request.user.clinic,
                    'license_number':         '',
                    'specialization':         '',
                    'discipline':             request.data.get('discipline', 'OCCUPATIONAL_THERAPY'),
                    'consultation_fee':       0,
                    'is_accepting_patients':  True,
                    # Availability fields
                    'duty_days':             request.data.get('duty_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
                    'duty_start_time':       request.data.get('duty_start_time', '08:00'),
                    'duty_end_time':         request.data.get('duty_end_time', '17:00'),
                    'lunch_start_time':      request.data.get('lunch_start_time', '12:00'),
                    'lunch_end_time':        request.data.get('lunch_end_time', '13:00'),
                    'duty_schedule':         request.data.get('duty_schedule', None),
                },
            )
            if practitioner_created:
                logger.info(
                    "Practitioner profile created on role change for: %s by %s",
                    instance.email, request.user.email,
                )

        elif old_role == 'PRACTITIONER' and new_role != 'PRACTITIONER':
            # Role downgraded from PRACTITIONER — soft-delete or deactivate profile
            Practitioner.objects.filter(user=instance).update(is_deleted=True)
            logger.info(
                "Staff account deactivated on role change for: %s by %s",
                instance.email, request.user.email,
            )

        logger.info(
            "Staff account updated: %s (role: %s → %s) by %s",
            instance.email, old_role, new_role, request.user.email,
        )

        response_data = self.get_serializer(instance).data
        return Response({
            **response_data,
            **({'practitioner_profile_created': True} if practitioner_created else {}),
        })

    def destroy(self, request, *args, **kwargs):
        """Soft delete user."""
        instance = self.get_object()
        
        if instance.id == request.user.id:
            return Response(
                {'detail': 'You cannot delete your own account.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        instance.is_deleted = True
        instance.is_active  = False
        instance.save()
        
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


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly] 