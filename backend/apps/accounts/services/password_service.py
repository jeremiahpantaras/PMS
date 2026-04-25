from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.accounts.utils.generators import generate_secure_password


class PasswordService:
    """Service for password-related operations"""
    
    @staticmethod
    def generate_temporary_password() -> str:
        """
        Generate a temporary password for new users.
        
        Returns:
            str: Generated secure password
        """
        return generate_secure_password(length=12)
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """
        Validate password strength using Django validators.
        
        Args:
            password: Password to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        try:
            validate_password(password)
            return True, ""
        except ValidationError as e:
            return False, ", ".join(e.messages)
    
    @staticmethod
    def hash_password(user, password: str):
        """
        Hash and set password for user.
        
        Args:
            user: User instance
            password: Plain text password
        """
        user.set_password(password)
        user.save(update_fields=['password'])

    
    @staticmethod
    def reset_password(user, new_password: str | None = None, rotation: str | None = None) -> str:
        """
        Reset a user's password.

        - If ``new_password`` is None a secure temporary password is generated,
          ``password_changed`` is set to False (forces change on next login).
        - If ``new_password`` is provided it is used directly and
          ``password_changed`` is set to True (user chose their own password).
        - ``rotation`` updates the ``password_rotation`` schedule when supplied.
        - ``last_password_change`` is always updated to now().

        Returns the plain-text password (only used once, to send via email for
        auto-generated passwords; never logged or stored in plaintext).
        """
        is_auto = new_password is None
        if is_auto:
            new_password = PasswordService.generate_temporary_password()

        user.set_password(new_password)
        # Auto-generated → force change on next login; user-chosen → no forced change
        user.password_changed = not is_auto
        user.last_password_change = timezone.now()

        update_fields = ['password', 'password_changed', 'last_password_change']
        if rotation is not None:
            user.password_rotation = rotation
            update_fields.append('password_rotation')

        user.save(update_fields=update_fields)
        return new_password